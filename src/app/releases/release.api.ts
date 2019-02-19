/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { assign, cloneDeep, difference, extend, intersection, isUndefined, keys, orderBy, pick } from 'lodash';
import { Types } from 'mongoose';

import { acl } from '../common/acl';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { isCreator } from '../common/mongoose/util';
import { SerializerOptions } from '../common/serializer';
import { Context } from '../common/typings/context';
import { GameDocument } from '../games/game.document';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { ReleaseAbstractApi } from './release.abstract.api';
import { ReleaseDocument } from './release.document';
import { ReleaseListQueryBuilder } from './release.list.query.builder';
import { ReleaseVersionFileDocument } from './version/file/release.version.file.document';
import { ReleaseVersionDocument } from './version/release.version.document';

export class ReleaseApi extends ReleaseAbstractApi {

	/**
	 * Creates a new release.
	 *
	 * @see POST /v1/releases
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.create');
		let release: ReleaseDocument;
		const now = new Date();

		try {
			// defaults
			if (ctx.request.body.versions) {
				ctx.request.body.versions.forEach((version: ReleaseVersionDocument) => {
					version.released_at = version.released_at || now.toISOString();
					if (version.files) {
						const releasedAt = version.released_at || now.toISOString();
						version.files.forEach((file: ReleaseVersionFileDocument) => {
							file.released_at = file.released_at || releasedAt;
						});
					}
				});
			}

			logger.info(ctx.state, '[ReleaseApi.create] Body: %s', JSON.stringify(ctx.request.body));
			const newRelease = await state.models.Release.getInstance(ctx.state, extend(ctx.request.body, {
				_created_by: ctx.state.user._id,
				modified_at: now,
				created_at: now,
			}));

			release = newRelease;
			await this.preProcess(ctx, newRelease.getFileIds());
			await release.validate();

			logger.info(ctx.state, '[ReleaseApi.create] Validations passed.');
			release.versions = orderBy(release.versions, ['released_at'], ['desc']);
			release.released_at = release.versions[0].released_at as Date;
			await release.save();

			await this.postProcess(ctx.state, release.getPlayfieldImageIds());

			logger.info(ctx.state, '[ReleaseApi.create] Release "%s" created.', release.name);
			await release.activateFiles();

			logger.info(ctx.state, '[ReleaseApi.create] All referenced files activated, returning object to client.');

			release = await this.getDetails(release._id);

			// log event
			await LogEventUtil.log(ctx, 'create_release', true, {
				release: state.serializers.Release.detailed(ctx, release, { thumbFormat: 'medium' }),
				game: pick(state.serializers.Game.simple(ctx, release._game as GameDocument), ['id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type']),
			}, {
				release: release._id,
				game: release._game._id,
			});

			// invalidate cache
			await apiCache.invalidateCreatedRelease(ctx.state, release);

			// notify (co-)author(s)
			for (const author of release.authors) {
				if ((author._user as UserDocument).id !== ctx.state.user.id) {
					await mailer.releaseAdded(ctx.state, ctx.state.user, author._user as UserDocument, release);
				}
			}

			this.success(ctx, state.serializers.Release.detailed(ctx, release, { includedFields: ['is_active'] }), 201);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// handle moderation mails
			if (release.moderation.is_approved) {
				await (release._game as GameDocument).incrementCounter('releases');
				await mailer.releaseAutoApproved(ctx.state, ctx.state.user, release);
			} else {
				await mailer.releaseSubmitted(ctx.state, ctx.state.user, release);
			}
			await (release._game as GameDocument).update({ modified_at: new Date() });
		});
	}

	/**
	 * Updates the release data (only basic data, no versions or files).
	 *
	 * @see PATCH /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.update');
		const updatableFields = ['name', 'description', '_tags', 'links', 'acknowledgements', 'authors', 'ipdb'];
		let release: ReleaseDocument;
		let oldRelease: ReleaseDocument;

		try {
			release = await state.models.Release.findOne({ id: ctx.params.id }).exec();

			// fail if invalid id
			if (!release) {
				throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404).log();
			}
			logger.info(ctx.state, '[ReleaseApi.update] Body: %s', JSON.stringify(ctx.request.body));

			// check for global update permissions
			const canUpdate = await acl.isAllowed(ctx.state.user.id, 'releases', 'update');

			// if user only has permissions to update own releases, check if owner.
			if (!canUpdate) {
				// fail if wrong user
				if (!isCreator(ctx, release)) {
					throw new ApiError('Only authors and owners of the release can update it.').status(403).log();
				}

				// fail if authors are updated by non-owner
				if (!isUndefined(ctx.request.body.authors) && release._created_by.toString() !== ctx.state.user._id.toString()) {
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
			oldRelease = cloneDeep(release);

			// apply changes
			release = await release.updateInstance(ctx.state, ctx.request.body);

			// validate and save
			release = await release.save();

			// re-fetch release object tree
			release = await this.getDetails(release._id);

			// log event
			await LogEventUtil.log(ctx, 'update_release', false,
				LogEventUtil.diff(oldRelease, ctx.request.body),
				{ release: release._id, game: release._game._id },
			);

			// invalidate cache
			await apiCache.invalidateUpdatedRelease(ctx.state, release);

			this.success(ctx, state.serializers.Release.detailed(ctx, release), 200);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Lists all releases.
	 *
	 * @see GET /v1/releases
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.list');
		try {
			const pagination = this.pagination(ctx, 12, 60);
			let starredReleaseIds: string[] = null;
			const fields = this.getRequestedFields(ctx);
			const serializerOpts = this.parseQueryThumbOptions(ctx);

			if (fields.includes('moderation')) {
				await state.models.Release.assertModerationField(ctx);
				serializerOpts.includedFields = ['moderation'];
			}

			// user starred status
			if (ctx.state.user) {
				const starsResult = await state.models.Star.find({
					type: 'release',
					_from: ctx.state.user._id,
				}, '_ref.release').exec();
				starredReleaseIds = starsResult.map(s => s._ref.release.toString());
			}

			// moderation && restricted games
			let query = await state.models.Release.applyRestrictions(ctx, await state.models.Release.handleModerationQuery(ctx, []));

			// filters
			const qb = new ReleaseListQueryBuilder();
			qb.filterByTag(ctx.query.tags);
			qb.filterByReleaseIds(ctx.query.ids);
			qb.filterByValidationStatus(ctx.query.validation);
			qb.filterByFlavor(ctx.query.flavor);
			await qb.filterByQuery(ctx.query.q);
			await qb.filterByProviderUser(ctx.query.provider_user, ctx.state.tokenType, ctx.state.tokenProvider);
			await qb.filterByStarred(ctx.query.starred, ctx.state.user, starredReleaseIds);
			await qb.filterByCompatibility(ctx.query.builds);
			await qb.filterByFileSize(parseInt(ctx.query.filesize, 10), parseInt(ctx.query.threshold, 10));
			// todo filter by user id

			query = [...query, ...qb.getQuery()];

			const sort = this.sortParams(ctx, { released_at: 1 }, {
				released_at: '-released_at',
				popularity: '-metrics.popularity',
				rating: '-rating.score',
				name: 'name_sortable',
				num_downloads: '-counter.downloads',
				num_comments: '-counter.comments',
				num_stars: '-counter.stars',
			});
			const populatedFields = ['_game', 'versions.files._file', 'versions.files._playfield_image',
				'versions.files._compatibility', 'authors._user'];

			const searchQuery = this.searchQuery(query);
			logger.info(ctx.state, '[ReleaseApi.list] query: %j, sort: %j', searchQuery, sort);

			const results = await state.models.Release.paginate(searchQuery, {
				page: pagination.page,
				limit: pagination.perPage,
				populate: populatedFields,
				sort,  // '_game.title', '_game.id'
			});

			const releases = results.docs.map(release => {
				if (starredReleaseIds) {
					serializerOpts.starred = starredReleaseIds.includes(release._id.toString());
				}
				release = state.serializers.Release.simple(ctx, release, Object.assign({}, qb.getSerializerOpts(), serializerOpts));

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

			this.success(ctx, releases, 200, this.paginationOpts(pagination, results.total));

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Lists a release of a given ID.
	 *
	 * @see GET /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.view');
		try {
			const serializerOpts: SerializerOptions = {
				excludedFields: [],
			};
			const release = await this.populateAll(state.models.Release.findOne({ id: ctx.params.id })).exec();

			if (!release) {
				throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
			}
			await release.assertRestrictedView(ctx);
			await release.assertModeratedView(ctx);

			const populated = await release.populateModeration(ctx, this.getRequestedFields(ctx));
			if (populated !== false) {
				serializerOpts.includedFields = ['moderation'];
			}

			await release.incrementCounter('views');

			// user starred status
			if (ctx.state.user) {
				const star = await state.models.Star.findOne({
					type: 'release',
					_from: ctx.state.user._id,
					'_ref.release': release._id,
				}).exec();
				if (star) {
					serializerOpts.starred = true;
				}
			}

			if (ctx.query.thumb_flavor) {
				serializerOpts.thumbFlavor = ctx.query.thumb_flavor;
				// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
			}
			if (ctx.query.thumb_format) {
				serializerOpts.thumbFormat = ctx.query.thumb_format;
			}

			serializerOpts.thumbPerFile = this.parseBoolean(ctx.query.thumb_per_file);
			serializerOpts.full = this.parseBoolean(ctx.query.full);

			this.success(ctx, state.serializers.Release.detailed(ctx, release, serializerOpts));

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Deletes a release.
	 *
	 * @see DELETE /v1/releases/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.del');
		let release: ReleaseDocument;
		try {
			release = await state.models.Release.findOne({ id: ctx.params.id })
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

			// invalidate cache
			await apiCache.invalidateDeletedRelease(ctx.state, release);

			// remove from db
			await release.remove();

			// log event
			await LogEventUtil.log(ctx, 'delete_release', false,
				{ release: pick(state.serializers.Release.simple(ctx, release), ['id', 'name', 'authors', 'versions']) },
				{ release: release._id, game: release._game },
			);

			logger.info(ctx.state, '[ReleaseApi.delete] Release "%s" (%s) successfully deleted.', release.name, release.id);
			this.success(ctx, null, 204);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Moderates a release.
	 *
	 * @see POST /v1/releases/:id/moderate
	 * @param {Context} ctx Koa context
	 */
	public async moderate(ctx: Context) {

		const span = this.apmStartSpan('ReleaseApi.moderate');
		try {
			let release = await state.models.Release.findOne({ id: ctx.params.id })
				.populate('_game')
				.populate('_created_by')
				.exec();

			if (!release) {
				throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
			}
			const moderationEvent = await state.models.Release.handleModeration(ctx, release);
			switch (moderationEvent.event) {
				case 'approved':
					await mailer.releaseApproved(ctx.state, release._created_by as UserDocument, release, moderationEvent.message);
					break;
				case 'refused':
					await mailer.releaseRefused(ctx.state, release._created_by as UserDocument, release, moderationEvent.message);
					break;
			}

			// if message set, create a comment.
			if (moderationEvent.message) {
				const comment = new state.models.Comment({
					_from: ctx.state.user._id,
					_ref: { release_moderation: release },
					message: moderationEvent.message,
					ip: this.getIpAddress(ctx),
					created_at: new Date(),
				});
				await comment.save();
			}
			release = await state.models.Release.findById(release._id)
				.populate('moderation.history._created_by')
				.exec();

			this.success(ctx, state.serializers.Release.detailed(ctx, release, { includedFields: ['moderation'] }).moderation, 200);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Reads and validates thumb parameters from the query and puts them into the serializer options.
	 *
	 * @param {Context} ctx Koa context
	 * @param {SerializerOptions} serializerOpts Current serializer options
	 * @returns {SerializerOptions}
	 */
	private parseQueryThumbOptions(ctx: Context, serializerOpts: SerializerOptions = {}): SerializerOptions {
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

		return serializerOpts;
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
