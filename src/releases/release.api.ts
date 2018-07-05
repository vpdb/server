/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { inspect } from 'util';
import { assign, cloneDeep, difference, extend, intersection, isArray, isUndefined, keys, orderBy, pick } from 'lodash';
import { Types } from 'mongoose';

import { state } from '../state';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { acl } from '../common/acl';
import { logger } from '../common/logger';
import { SerializerOptions } from '../common/serializer';
import { mailer } from '../common/mailer';
import { apiCache } from '../common/api.cache';
import { LogEventUtil } from '../log-event/log.event.util';
import { Game } from '../games/game';
import { User } from '../users/user';
import { ReleaseVersion } from './release.version';
import { ReleaseVersionFile } from './release.version.file';
import { flavors } from './release.flavors';
import { ReleaseAbstractApi } from './release.abstract.api';

export class ReleaseApi extends ReleaseAbstractApi {

	/**
	 * Creates a new release.
	 *
	 * @see POST /v1/releases
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const now = new Date();
		let release;

		// defaults
		if (ctx.request.body.versions) {
			ctx.request.body.versions.forEach((version: ReleaseVersion) => {
				version.released_at = version.released_at || now.toISOString();
				if (version.files) {
					const releasedAt = version.released_at || now.toISOString();
					version.files.forEach((file: ReleaseVersionFile) => {
						file.released_at = file.released_at || releasedAt;
					});
				}
			});
		}

		logger.info('[ReleaseApi.create] Body: %s', inspect(ctx.request.body, { depth: null }));
		const newRelease = await state.models.Release.getInstance(extend(ctx.request.body, {
			_created_by: ctx.state.user._id,
			modified_at: now,
			created_at: now
		}));

		release = newRelease;
		await this.preProcess(ctx, newRelease.getFileIds());
		await release.validate();

		logger.info('[ReleaseApi.create] Validations passed.');
		release.versions = orderBy(release.versions, ['released_at'], ['desc']);
		release.released_at = release.versions[0].released_at as Date;
		await release.save();

		await this.postProcess(release.getPlayfieldImageIds());

		logger.info('[ReleaseApi.create] Release "%s" created.', release.name);
		await release.activateFiles();

		logger.info('[ReleaseApi.create] All referenced files activated, returning object to client.');

		// update counters and date
		release = await release.populate('_game').execPopulate();

		if (release.moderation.is_approved) {
			await (release._game as Game).incrementCounter('releases');
			await mailer.releaseAutoApproved(ctx.state.user, release);
		} else {
			await mailer.releaseSubmitted(ctx.state.user, release);
		}
		await (release._game as Game).update({ modified_at: new Date() });

		release = await this.getDetails(release._id);
		this.success(ctx, state.serializers.Release.detailed(ctx, release), 201);

		await LogEventUtil.log(ctx, 'create_release', true, {
			release: state.serializers.Release.detailed(ctx, release, { thumbFormat: 'medium' }),
			game: pick(state.serializers.Game.simple(ctx, release._game as Game), ['id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type'])
		}, {
			release: release._id,
			game: release._game._id
		});

		// notify (co-)author(s)
		for (const author of release.authors) {
			if ((author._user as User).id !== ctx.state.user.id) {
				await mailer.releaseAdded(ctx.state.user, author._user as User, release);
			}
		}

		// invalidate cache
		await apiCache.invalidateRelease(release);
	}

	/**
	 * Updates the release data (only basic data, no versions or files).
	 *
	 * @see PATCH /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['name', 'description', '_tags', 'links', 'acknowledgements', 'authors', 'ipdb'];

		let release = await state.models.Release.findOne({ id: ctx.params.id }).exec();

		// fail if invalid id
		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404).log();
		}

		// check for global update permissions
		const canUpdate = await acl.isAllowed(ctx.state.user.id, 'releases', 'update');

		// if user only has permissions to update own releases, check if owner.
		if (!canUpdate) {
			// fail if wrong user
			const authorIds = release.authors.map(a => a._user.toString());
			const creatorId = release._created_by.toString();
			if (![creatorId, ...authorIds].includes(ctx.state.user._id.toString())) {
				throw new ApiError('Only authors of the release can update it.').status(403).log();
			}
			if (!isUndefined(ctx.request.body.authors) && creatorId !== ctx.state.user._id.toString()) {
				throw new ApiError('Only the original uploader can edit authors.').status(403).log();
			}
		}

		// fail if invalid fields provided
		const submittedFields = keys(ctx.request.body);
		if (intersection(updatableFields, submittedFields).length !== submittedFields.length) {
			const invalidFields = difference(submittedFields, updatableFields);
			throw new ApiError('Invalid field%s: ["%s"]. Allowed fields: ["%s"]', invalidFields.length === 1 ? '' : 's', invalidFields.join('", "'), updatableFields.join('", "')).status(400).log();
		}
		if (ctx.request.body.ipdb) {
			ctx.request.body.ipdb = assign(release.ipdb, pick(ctx.request.body.ipdb, 'mpu'));
		}
		const oldRelease = cloneDeep(release);

		// apply changes
		release = await release.updateInstance(ctx.request.body);

		// validate and save
		release = await release.save();

		// re-fetch release object tree
		release = await this.getDetails(release._id);
		this.success(ctx, state.serializers.Release.detailed(ctx, release), 200);

		// invalidate cache
		await apiCache.invalidateRelease(release);

		// log event
		await LogEventUtil.log(ctx, 'update_release', false,
			LogEventUtil.diff(oldRelease, ctx.request.body),
			{ release: release._id, game: release._game._id }
		);
	}

	/**
	 * Lists all releases.
	 *
	 * @see GET /v1/releases
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		let pagination = this.pagination(ctx, 12, 60);
		let starredReleaseIds: string[] = null;
		let titleRegex: RegExp = null;
		let serializerOpts: SerializerOptions = {};
		let fields = ctx.query && ctx.query.fields ? ctx.query.fields.split(',') : [];

		// flavor, thumb selection
		if (ctx.query.thumb_flavor) {
			serializerOpts.thumbFlavor = ctx.query.thumb_flavor;
			// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
		}
		if (ctx.query.thumb_format) {
			serializerOpts.thumbFormat = ctx.query.thumb_format;
		}
		serializerOpts.fullThumbData = this.parseBoolean(ctx.query.thumb_full_data);
		serializerOpts.thumbPerFile = this.parseBoolean(ctx.query.thumb_per_file);

		// check
		if (serializerOpts.thumbPerFile && !serializerOpts.thumbFormat) {
			throw new ApiError('You must specify "thumb_format" when requesting thumbs per file.').status(400);
		}

		if (fields.includes('moderation')) {
			if (!ctx.state.user) {
				throw new ApiError('You must be logged in order to fetch moderation fields.').status(403);
			}
			const isModerator = await acl.isAllowed(ctx.state.user.id, 'releases', 'moderate');
			if (!isModerator) {
				throw new ApiError('You must be moderator in order to fetch moderation fields.').status(403);
			}
			serializerOpts.includedFields = ['moderation'];
		}

		// moderation && restricted games
		const query = await state.models.Release.handleGameQuery(ctx, await state.models.Release.handleModerationQuery(ctx, []));

		// filter by tag
		if (ctx.query.tags) {
			let t = ctx.query.tags.split(',');
			// all tags must be matched
			for (let i = 0; i < t.length; i++) {
				query.push({ _tags: { $in: [t[i]] } });
			}
		}

		// filter by release id
		if (ctx.query.ids) {
			let ids = ctx.query.ids.split(',');
			query.push({ id: { $in: ids } });
		}

		// filter by query
		if (ctx.query.q) {

			if (ctx.query.q.trim().length < 3) {
				throw new ApiError('Query must contain at least two characters.').status(400);
			}

			// sanitize and build regex
			let titleQuery = ctx.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
			titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			let idQuery = ctx.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			let q = {
				'counter.releases': { $gt: 0 },
				$or: [{ title: titleRegex }, { id: idQuery }]
			};
			const games = await state.models.Game.find(q, '_id').exec();
			let gameIds = games.map(g => g._id);
			if (gameIds.length > 0) {
				query.push({ $or: [{ name: titleRegex }, { _game: { $in: gameIds } }] });
			} else {
				query.push({ name: titleRegex });
			}
		}

		// todo filter by user id

		// filter by provider user id
		if (ctx.query.provider_user) {
			if (ctx.state.tokenType !== 'provider') {
				throw new ApiError('Must be authenticated with provider token in order to filter by provider user ID.').status(400);
			}
			const user = await state.models.User.findOne({ ['providers.' + ctx.state.tokenProvider + '.id']: String(ctx.query.provider_user) });
			if (user) {
				query.push({ 'authors._user': user._id.toString() });
			}
		}

		// user starred status
		if (ctx.state.user) {
			const starsResult = await state.models.Star.find({
				type: 'release',
				_from: ctx.state.user._id
			}, '_ref.release').exec();
			starredReleaseIds = starsResult.map(s => s._ref.release.toString());
		}

		// starred filter
		if (!isUndefined(ctx.query.starred)) {

			if (!ctx.state.user) {
				throw new ApiError('Must be logged when listing starred releases.').status(401);
			}
			if (ctx.query.starred === 'false') {
				query.push({ _id: { $nin: starredReleaseIds } });
			} else {
				query.push({ _id: { $in: starredReleaseIds } });
			}
		}

		// compat filter
		if (!isUndefined(ctx.query.builds)) {
			let buildIds = ctx.query.builds.split(',');
			const builds = await state.models.Build.find({ id: { $in: buildIds } }).exec();
			query.push({ 'versions.files._compatibility': { $in: builds.map(b => b._id) } });
		}

		// validation filter
		const validationStatusValues = ['verified', 'playable', 'broken'];
		if (!isUndefined(ctx.query.validation)) {
			if (validationStatusValues.includes(ctx.query.validation)) {
				query.push({ 'versions.files.validation.status': ctx.query.validation });
			}
			if (ctx.query.validation === 'none') {
				query.push({ 'versions.files.validation': { $exists: false } });
			}
		}

		// file size filter
		let fileSize = parseInt(ctx.query.filesize, 10);
		if (fileSize) {
			let threshold = parseInt(ctx.query.threshold, 10);
			let q: any = { file_type: 'release' };
			if (threshold) {
				q.bytes = { $gt: fileSize - threshold, $lt: fileSize + threshold };
			} else {
				q.bytes = fileSize;
			}
			const files = await state.models.File.find(q).exec();
			if (files && files.length > 0) {
				serializerOpts.fileIds = files.map(f => f.id);
				query.push({ 'versions.files._file': { $in: files.map(f => f._id) } });
			} else {
				query.push({ _id: null }); // no result
			}
		}

		// flavor filters
		if (!isUndefined(ctx.query.flavor)) {
			ctx.query.flavor.split(',').forEach((f: string) => {
				const [key, val] = f.split(':');
				if (flavors.values[key]) {
					query.push({ ['versions.files.flavor.' + key]: { $in: ['any', val] } });
				}
			});
			// also return the same thumb if not specified otherwise.
			if (!serializerOpts.thumbFlavor) {
				serializerOpts.thumbFlavor = ctx.query.flavor;
			}
		}

		const sort = this.sortParams(ctx, { released_at: 1 }, {
			released_at: '-released_at',
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			name: 'name_sortable',
			num_downloads: '-counter.downloads',
			num_comments: '-counter.comments',
			num_stars: '-counter.stars'
		});
		let populatedFields = ['_game', 'versions.files._file', 'versions.files._playfield_image',
			'versions.files._compatibility', 'authors._user'];

		const searchQuery = this.searchQuery(query);
		logger.info('[ReleaseApi.list] query: %j, sort: %j', searchQuery, sort);

		const results = await state.models.Release.paginate(searchQuery, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: populatedFields,
			sort: sort  // '_game.title', '_game.id'
		});

		let releases = results.docs.map(release => {
			if (starredReleaseIds) {
				serializerOpts.starred = starredReleaseIds.includes(release._id.toString());
			}
			release = state.serializers.Release.simple(ctx, release, serializerOpts);

			// if flavor specified, filter returned files to match filter
			if (!isUndefined(ctx.query.flavor)) {
				release.versions = release.versions.filter(version => {
					ctx.query.flavor.split(',').forEach((f: string) => {
						const [key, val] = f.split(':');
						version.files = version.files.filter(file => file.flavor[key] === val);
					});
					return version.files.length > 0;
				});
			}
			return release;
		});

		return this.success(ctx, releases, 200, this.paginationOpts(pagination, results.total));
	}

	/**
	 * Lists a release of a given ID.
	 *
	 * @see GET /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		let opts:SerializerOptions = {
			excludedFields: []
		};
		let release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate({ path: '_game' })
			.populate({ path: '_tags' })
			.populate({ path: '_created_by' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._playfield_image' })
			.populate({ path: 'versions.files._playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.populate({ path: 'versions.files.validation._validated_by' })
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		const hasAccess = await state.models.Release.hasRestrictionAccess(ctx, release._game as Game, release);
		if (!hasAccess) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		release = await release.assertModeratedView(ctx);
		const fields = ctx.query && ctx.query.fields ? ctx.query.fields.split(',') : [];
		const populated = await release.populateModeration(ctx, { includedFields: fields });
		if (populated === false) {
			opts.excludedFields.push('moderation');
		}

		await release.incrementCounter('views');

		// user starred status
		if (ctx.state.user) {
			const star = await state.models.Star.findOne({
				type: 'release',
				_from: ctx.state.user._id,
				'_ref.release': release._id
			}).exec();
			if (star) {
				opts.starred = true;
			}
		}

		if (ctx.query.thumb_flavor) {
			opts.thumbFlavor = ctx.query.thumb_flavor;
			// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
		}
		if (ctx.query.thumb_format) {
			opts.thumbFormat = ctx.query.thumb_format;
		}

		opts.thumbPerFile = this.parseBoolean(ctx.query.thumb_per_file);
		opts.full = this.parseBoolean(ctx.query.full);

		return this.success(ctx, state.serializers.Release.detailed(ctx, release, opts));
	}

	/**
	 * Deletes a release.
	 *
	 * @see DELETE /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._playfield_image' })
			.populate({ path: 'versions.files._playfield_video' })
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}

		// only allow deleting own files (for now)
		if (!(release._created_by as Types.ObjectId).equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}

		// remove from db
		await release.remove();

		// invalidate cache
		await apiCache.invalidateRelease();

		logger.info('[ReleaseApi.delete] Release "%s" (%s) successfully deleted.', release.name, release.id);

		// log event
		await LogEventUtil.log(ctx, 'delete_release', false,
			{ release: pick(state.serializers.Release.simple(ctx, release), ['id', 'name', 'authors', 'versions']) },
			{ release: release._id, game: release._game }
		);

		return this.success(ctx, null, 204);
	}

	/**
	 * Moderates a release.
	 *
	 * @see POST /v1/releases/:id/moderate
	 * @param {Context} ctx Koa context
	 */
	public async moderate(ctx: Context) {

		const release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}
		const moderation = await state.models.Release.handleModeration(ctx, release);

		let lastEvent;
		if (isArray(moderation.history)) {
			moderation.history.sort((m1, m2) => m2.created_at.getTime() - m1.created_at.getTime());
			lastEvent = moderation.history[0];
			const errHandler = (err: Error) => logger.error('[moderation] Error sending moderation mail: %s', err.message);
			switch (lastEvent.event) {
				case 'approved':
					await mailer.releaseApproved(release._created_by as User, release, lastEvent.message).catch(errHandler);
					break;
				case 'refused':
					await mailer.releaseRefused(release._created_by as User, release, lastEvent.message).catch(errHandler);
					break;
			}
		}

		// if message set, create a comment.
		if (lastEvent.message) {
			let comment = new state.models.Comment({
				_from: ctx.state.user._id,
				_ref: { release_moderation: release },
				message: lastEvent.message,
				ip: this.getIpAddress(ctx),
				created_at: new Date()
			});
			await comment.save();
		}

		return this.success(ctx, moderation, 200);
	}

	/**
	 * Parses a boolean value provided by the request
	 * @param {string} value Value to parse
	 * @returns {boolean}
	 */
	private parseBoolean(value: string) {
		return !isUndefined(value) && value.toLowerCase() !== 'false';
	}
}