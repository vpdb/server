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

import gm from 'gm';
import { exists } from 'fs';
import { inspect, promisify } from 'util';
import { assign, cloneDeep, defaults, difference, extend, intersection, isArray, isUndefined, keys, orderBy, pick } from 'lodash';
import { Types } from 'mongoose';

import { state } from '../state';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { acl } from '../common/acl';
import { logger } from '../common/logger';
import { SerializerOptions } from '../common/serializer';
import { mailer } from '../common/mailer';
import { LogEventUtil } from '../log-event/log.event.util';
import { Game } from '../games/game';
import { User } from '../users/user';
import { File } from '../files/file';
import { FileUtil } from '../files/file.util';
import { Release } from './release';
import { ReleaseVersionFile } from './release.version.file';
import { ReleaseVersion } from './release.version';
import { flavors } from './release.flavors';
import { Metadata } from '../files/metadata/metadata';
import { processorQueue } from '../files/processor/processor.queue';
import { apiCache } from '../common/api.cache';

const existsAsync = promisify(exists);
require('bluebird').promisifyAll(gm.prototype);

export class ReleaseApi extends Api {

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
		await this.preprocess(ctx, newRelease.getFileIds());
		await release.validate();

		logger.info('[ReleaseApi.create] Validations passed.');
		release.versions = orderBy(release.versions, ['released_at'], ['desc']);
		release.released_at = release.versions[0].released_at as Date;
		await release.save();

		await this.postprocess(release.getPlayfieldImageIds());

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
	 * Adds a new version to an existing release.
	 *
	 * @see POST /v1/releases/:id/versions
	 * @param {Context} ctx Koa context
	 */
	public async addVersion(ctx: Context) {

		const now = new Date();
		let release = await state.models.Release.findOne({ id: ctx.params.id }).exec();

		// fail if release doesn't exist
		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}

		// check permission
		const authorIds = release.authors.map(a => a._user.toString());
		const creatorId = release._created_by.toString();
		let isAllowed: boolean;
		if ([creatorId, ...authorIds].includes(ctx.state.user._id.toString())) {
			isAllowed = true;
		} else {
			isAllowed = await acl.isAllowed(ctx.state.user.id, 'releases', 'update');
		}

		if (!isAllowed) {
			throw new ApiError('Only moderators or authors of the release can add new versions.').status(403).log();
		}

		// set defaults
		const versionObj = defaults(ctx.request.body, { released_at: now }) as ReleaseVersion;
		if (versionObj.files) {
			versionObj.files.forEach(file => {
				defaults(file, { released_at: now });
			});
		}

		// create instance
		logger.info('[ReleaseApi.addVersion] body: %s', inspect(versionObj, { depth: null }));
		const newVersion = await state.models.ReleaseVersion.getInstance(versionObj);

		await this.preprocess(ctx, newVersion.getFileIds());

		logger.info('[ReleaseApi.addVersion] model: %s', inspect(newVersion, { depth: null }));
		let validationErr: any;

		try {
			await newVersion.validate();
		} catch (err) {
			validationErr = err
		} finally {
			// validate existing version here
			if (release.versions.filter(v => v.version === newVersion.version).length > 0) {
				validationErr = validationErr || {};
				validationErr.errors = [{
					path: 'version',
					message: 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.',
					value: newVersion.version
				}];
			}
			if (validationErr) {
				throw new ApiError('Validations failed. See below for details.').validationErrors(validationErr.errors).warn().status(422);
			}
		}

		release.versions.push(newVersion);
		release.versions = orderBy(release.versions, ['released_at'], ['desc']);
		release.released_at = release.versions[0].released_at as Date;
		release.modified_at = now;

		logger.info('[ReleaseApi.addVersion] Validations passed, adding new version to release.');
		release = await release.save();

		await this.postprocess(newVersion.getPlayfieldImageIds());

		logger.info('[ReleaseApi.create] Added version "%s" to release "%s".', newVersion.version, release.name);
		// set media to active
		await release.activateFiles();

		// game modification date
		await state.models.Game.update({ _id: release._game.toString() }, { modified_at: now });

		logger.info('[ReleaseApi.create] All referenced files activated, returning object to client.');
		release = await this.getDetails(release._id);

		this.success(ctx, state.serializers.Release.detailed(ctx, release).versions.filter(v => v.version === newVersion.version)[0], 201);

		// invalidate cache
		await apiCache.invalidateRelease(release);

		// log event
		await LogEventUtil.log(ctx, 'create_release_version', true, {
			release: pick(state.serializers.Release.detailed(ctx, release, { thumbFormat: 'medium' }), ['id', 'name', 'authors', 'versions']),
			game: pick(state.serializers.Game.simple(ctx, release._game as Game), ['id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type'])
		}, {
			release: release._id,
			game: release._game._id
		});

		// notify pusher
		//pusher.addVersion(release._game, release, newVersion);

		// notify (co-)author(s)
		for (const author of release.authors) {
			if ((author._user as User).id !== ctx.state.user.id) {
				await mailer.releaseVersionAdded(ctx.state.user, author._user as User, release, newVersion);
			}
		}
	}

	/**
	 * Updates an existing version.
	 *
	 * @see PATCH /v1/releases/:id/versions/:version
	 * @param {Context} ctx Koa context
	 */
	public async updateVersion(ctx: Context) {

		const updatableFields = ['released_at', 'changes'];
		const updatableFileFields = ['flavor', '_compatibility', '_playfield_image', '_playfield_video'];
		const now = new Date();

		// retrieve release
		let release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('versions.files._compatibility')
			.populate('versions.files._file')
			.exec();

		// fail if no release
		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}

		// fail if no version
		let version = release.versions.find(v => v.version === ctx.params.version);
		if (!version) {
			throw new ApiError('No such version "%s" for release "%s".', ctx.params.version, ctx.params.id).status(404);
		}

		// check permissions
		const authorIds = release.authors.map(a => a._user.toString());
		const creatorId = release._created_by.toString();
		let hasPermission: boolean;
		if ([creatorId, ...authorIds].includes(ctx.state.user._id.toString())) {
			hasPermission = true;
		} else {
			// check for global update permissions
			hasPermission = await acl.isAllowed(ctx.state.user.id, 'releases', 'update');
		}
		if (!hasPermission) {
			throw new ApiError('Only moderators and authors of the release can update a version.').status(403).log();
		}

		// retrieve release with no references that we can update
		const releaseToUpdate = await state.models.Release.findOne({ id: ctx.params.id }).exec();

		const versionToUpdate = releaseToUpdate.versions.find(v => v.version === ctx.params.version);
		const oldVersion = cloneDeep(versionToUpdate);

		const newFiles: ReleaseVersionFile[] = [];
		logger.info('[ReleaseApi.updateVersion] %s', inspect(ctx.request.body, { depth: null }));

		for (const fileObj of (ctx.request.body.files || [])) {

			// check if file reference is already part of this version
			let existingVersionFile = version.files.find(f => (f._file as File).id === fileObj._file);
			if (existingVersionFile) {
				let versionFileToUpdate = versionToUpdate.files.find(f => f._id.equals(existingVersionFile._id));
				await versionFileToUpdate.updateInstance(pick(fileObj, updatableFileFields));

			} else {
				defaults(fileObj, { released_at: now });
				const newVersionFile = await state.models.ReleaseVersionFile.getInstance(fileObj);
				versionToUpdate.files.push(newVersionFile);
				newFiles.push(newVersionFile);
			}
		}

		await this.preprocess(ctx, versionToUpdate.getFileIds().concat(version.getFileIds(newFiles)));

		// assign fields and validate
		Object.assign(versionToUpdate, pick(ctx.request.body, updatableFields));
		try {
			await releaseToUpdate.validate();
		} catch (err) {
			await this.rollbackPreprocess(ctx);
			throw err;
		}

		logger.info('[ReleaseApi.updateVersion] Validations passed, updating version.');

		releaseToUpdate.versions = orderBy(releaseToUpdate.versions, ['released_at'], ['desc']);
		releaseToUpdate.released_at = releaseToUpdate.versions[0].released_at as Date;
		releaseToUpdate.modified_at = now;
		release = await releaseToUpdate.save();

		await this.postprocess(versionToUpdate.getPlayfieldImageIds());

		if (newFiles.length > 0) {
			logger.info('[ReleaseApi.updateVersion] Added new file(s) to version "%s" of release "%s".', version.version, release.name);
		}
		const activatedFiles = await release.activateFiles();

		logger.info('[ReleaseApi.updateVersion] Activated files [ %s ], returning object to client.', activatedFiles.join(', '));
		await state.models.Game.update({ _id: release._game.toString() }, { modified_at: new Date() });

		release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._playfield_image' })
			.populate({ path: 'versions.files._playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

		version = state.serializers.Release.detailed(ctx, release).versions.find(v => v.version = ctx.params.version);
		this.success(ctx, version, 200);

		// invalidate cache
		await apiCache.invalidateRelease(release);

		// log event
		await LogEventUtil.log(ctx, 'update_release_version', false,
			LogEventUtil.diff(oldVersion, ctx.request.body),
			{ release: release._id, game: release._game._id }
		);

		// notify (co-)author(s)
		for (const author of release.authors) {
			if ((author._user as User).id !== ctx.state.user.id) {
				for (const versionFile of newFiles) {
					await mailer.releaseFileAdded(ctx.state.user, author._user as User, release, version, versionFile);
				}
			}
		}
	}

	/**
	 * Validates a release file.
	 *
	 * @see POST /v1/releases/:id/versions/:version/files/:file/validate
	 * @param {Context} ctx Koa context
	 */
	public async validateFile(ctx: Context) {

		const now = new Date();

		let release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('versions.files._file')
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}
		let version = release.versions.find(v => v.version === ctx.params.version);
		if (!version) {
			throw new ApiError('No such version "%s" for release "%s".', ctx.params.version, ctx.params.id).status(404);
		}
		let file = version.files.find(f => (f._file as File).id === ctx.params.file);
		if (!file) {
			throw new ApiError('No file with ID "%s" for version "%s" of release "%s".', ctx.params.file, ctx.params.version, ctx.params.id).status(404);
		}
		const fileId = file._id;

		// validations
		let validationErrors = [];
		if (!ctx.request.body.message) {
			validationErrors.push({
				path: 'message',
				message: 'A message must be provided.',
				value: ctx.request.body.message
			});
		}
		if (!ctx.request.body.status) {
			validationErrors.push({ path: 'status', message: 'Status must be provided.', value: ctx.request.body.status });
		}
		if (validationErrors.length) {
			throw new ApiError('Validation error').validationErrors(validationErrors);
		}

		// retrieve release with no references that we can update
		const releaseToUpdate = await state.models.Release.findOne({ id: ctx.params.id }).exec();

		const versionToUpdate = releaseToUpdate.versions.find(v => v.version === ctx.params.version);
		const fileToUpdate = versionToUpdate.files.find(f => f._id.equals(fileId));

		fileToUpdate.validation = {
			status: ctx.request.body.status,
			message: ctx.request.body.message,
			validated_at: now,
			_validated_by: ctx.state.user._id
		};

		await releaseToUpdate.save();

		logger.info('[ReleaseApi.validateFile] Updated file validation status.');

		release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate({ path: '_created_by' })
			.populate({ path: '_game' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files.validation._validated_by' })
			.exec();

		version = release.versions.find(v => v.version === ctx.params.version);
		file = version.files.find(f => (f._file as File).id === ctx.params.file);

		this.success(ctx, state.serializers.ReleaseVersionFile.detailed(ctx, file).validation, 200);

		// log event
		await LogEventUtil.log(ctx, 'validate_release', false,
			{ validation: file.validation },
			{ release: release._id, game: release._game._id }
		);

		await mailer.releaseValidated(release._created_by as User, ctx.state.user, release._game as Game, release, file);
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
		if (ctx.query.resources) {
			let t = ctx.query.resources.split(',');
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
			if (ctx.state.tokenType !== 'application') {
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
		let fileIds: string[];
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
				fileIds = files.map(f => f.id);
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
		logger.info('[ReleaseApi.list] query: %s, sort: %j', inspect(searchQuery, { depth: null }), inspect(sort));

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
			serializerOpts.fileIds = fileIds;
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
			.populate({ path: 'versions.0.files.0._file' })
			.populate({ path: 'versions.0.files.0._playfield_image' })
			.populate({ path: 'versions.0.files.0._playfield_video' })
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
	 * Retrieves release details.
	 * @param id Database ID of the release to fetch
	 * @returns {Promise.<Release>}
	 */
	private getDetails(id: string) {
		return state.models.Release.findById(id)
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
	}

	/**
	 * Pre-processes stuff before running validations.
	 *
	 * Currently, the only "stuff" is rotation of referenced media.
	 * @param {Context} ctx Koa context
	 * @param {string[]} allowedFileIds Database IDs of file IDs of the current release that are allowed to be preprocessed.
	 * @returns {Promise}
	 */
	private async preprocess(ctx: Context, allowedFileIds: string[]): Promise<void> {

		if (ctx.query.rotate) {

			// validate input format
			let rotations = this.parseRotationParams(ctx.query.rotate);

			// validate input data
			for (const rotation of rotations) {
				const file = await state.models.File.findOne({ id: rotation.file }).exec();
				if (!file) {
					throw new ApiError('Cannot rotate non-existing file "%s".', rotation.file).status(404);
				}

				if (!allowedFileIds.includes(file._id.toString())) {
					throw new ApiError('Cannot rotate file %s because it is not part of the release (%s).', file.id, file._id).status(400);
				}
				if (file.getMimeCategory() !== 'image') {
					throw new ApiError('Can only rotate images, this is a "%s".', file.getMimeCategory()).status(400);
				}
				if (!['playfield', 'playfield-fs', 'playfield-ws'].includes(file.file_type)) {
					throw new ApiError('Can only rotate playfield images, got "%s".', file.file_type).status(400);
				}
				const src = await this.backupFile(file);

				// do the actual rotation
				if (rotation.angle !== 0) {
					file.preprocessed = file.preprocessed || {};
					file.preprocessed.rotation = file.preprocessed.rotation || 0;
					file.preprocessed.unvalidatedRotation = (file.preprocessed.rotation + rotation.angle + 360) % 360;

					logger.info('[ReleaseApi.preprocess] Rotating file "%s" %s° (was %s° before, plus %s°).', file.getPath(), file.preprocessed.unvalidatedRotation, file.preprocessed.rotation, rotation.angle);
					await (gm(src).rotate('black', -file.preprocessed.unvalidatedRotation) as any).writeAsync(file.getPath());
				}

				// update metadata
				const metadata = await Metadata.readFrom(file, file.getPath());
				await state.models.File.findByIdAndUpdate(file._id, {
					metadata: metadata,
					file_type: file.file_type,
					preprocessed: file.preprocessed
				}).exec();
			}
		}
	}

	/**
	 * Since we need to persist preprocessing changes before validating, we also need a way to
	 * roll them back when validations fail.
	 *
	 * @param {Context} ctx Koa context
	 */
	private async rollbackPreprocess(ctx: Context): Promise<void> {

		if (ctx.query.rotate) {

			// validate input format
			let rotations = this.parseRotationParams(ctx.query.rotate);

			// validate input data
			for (const rotation of rotations) {
				const file = await state.models.File.findOne({ id: rotation.file }).exec();
				if (!file) {
					throw new ApiError('Cannot rollback non-existing file "%s".', rotation.file).status(404);
				}
				const src = await this.backupFile(file);

				// do the actual rotation
				if (rotation.angle !== 0) {
					delete file.preprocessed.unvalidatedRotation;
					logger.info('[ReleaseApi.rollbackPreprocess] Rolling back rotated file "%s" to %s°.', file.getPath(), file.preprocessed.rotation);
					await (gm(src).rotate('black', file.preprocessed.rotation) as any).writeAsync(file.getPath());
				}

				// update metadata
				const metadata = await Metadata.readFrom(file, file.getPath());
				await state.models.File.findByIdAndUpdate(file._id, {
					metadata: metadata,
					file_type: file.file_type,
					preprocessed: file.preprocessed
				}).exec();
			}
		}
	}

	/**
	 * Runs post-processing on stuff that was pre-processed earlier (and probably
	 * needs to be post-processed again).
	 *
	 * @param {string[]} fileIds Database IDs of the files to re-process.
	 * @returns {Promise}
	 */
	private async postprocess(fileIds: string[]) {
		logger.info('[ReleaseApi.postprocess] Post-processing files [ %s ]', fileIds.join(', '));
		for (const id of fileIds) {
			const file = await state.models.File.findById(id).exec();
			// so now we're here and unvalidatedRotation is now validated.
			if (file.preprocessed && file.preprocessed.unvalidatedRotation) {
				logger.info('[ReleaseApi.postprocess] Validation passed, setting rotation to %s°', file.preprocessed.unvalidatedRotation);
				await state.models.File.update({ _id: file._id }, {
					preprocessed: { rotation: file.preprocessed.unvalidatedRotation }
				});
			}
			await processorQueue.processFile(file, file.getPath(null, { tmpSuffix: '_original' }));
		}
	}

	/**
	 * Parses the rotation query and throws an exception on incorrect format.
	 *
	 * @param {string} rotate Rotation query from URL
	 * @returns {{ file: string, angle: number }[]} Parsed rotation parameters
	 */
	private parseRotationParams(rotate: string) {
		return rotate.split(',').map(r => {
			if (!r.includes(':')) {
				throw new ApiError('When providing the "rotation" query, pairs must be separated by ":".').status(400);
			}
			let rot = r.split(':');

			if (!['0', '90', '180', '270'].includes(rot[1])) {
				throw new ApiError('Wrong angle "%s", must be one of: [0, 90, 180, 270].', rot[1]).status(400);
			}
			return { file: rot[0], angle: parseInt(rot[1], 10) };
		});
	}

	/**
	 * Copies a file to a backup location (if not already done) and returns
	 * the file name of the location.
	 *
	 * @param file File
	 * @returns {Promise.<string>} New location
	 */
	private async backupFile(file: File): Promise<string> {
		let backup = file.getPath(null, { tmpSuffix: '_original' });
		if (!(await existsAsync(backup))) {
			logger.info('[ReleaseApi.backupFile] Copying "%s" to "%s".', file.getPath(), backup);
			await FileUtil.cp(file.getPath(), backup);
		}
		return backup;
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