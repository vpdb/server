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
import { cloneDeep, defaults, orderBy, pick } from 'lodash';

import { state } from '../state';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { acl } from '../common/acl';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { LogEventUtil } from '../log-event/log.event.util';
import { Game } from '../games/game';
import { User } from '../users/user';
import { File } from '../files/file';
import { ReleaseVersionFile } from './release.version.file';
import { ReleaseVersion } from './release.version';
import { apiCache } from '../common/api.cache';
import { ReleaseAbstractApi } from './release.abstract.api';

export class ReleaseVersionApi extends ReleaseAbstractApi {

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


}