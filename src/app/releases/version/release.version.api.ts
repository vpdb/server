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

import { cloneDeep, defaults, orderBy, pick } from 'lodash';
import sanitize = require('mongo-sanitize');

import { acl } from '../../common/acl';
import { apiCache } from '../../common/api.cache';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { mailer } from '../../common/mailer';
import { Context } from '../../common/typings/context';
import { FileDocument } from '../../files/file.document';
import { GameDocument } from '../../games/game.document';
import { LogEventUtil } from '../../log-event/log.event.util';
import { state } from '../../state';
import { UserDocument } from '../../users/user.document';
import { ReleaseAbstractApi } from '../release.abstract.api';
import { ReleaseDocument } from '../release.document';
import { ReleaseVersionFileDocument } from './file/release.version.file.document';
import { ReleaseVersionDocument } from './release.version.document';

/* tslint:disable:no-unsafe-finally */
export class ReleaseVersionApi extends ReleaseAbstractApi {

	/**
	 * Adds a new version to an existing release.
	 *
	 * @see POST /v1/releases/:id/versions
	 * @param {Context} ctx Koa context
	 */
	public async addVersion(ctx: Context) {

		const span = this.apmStartSpan('ReleaseVersionApi.addVersion');
		let release: ReleaseDocument;
		let newVersion: ReleaseVersionDocument;

		try {
			const now = new Date();
			release = await state.models.Release.findOne({ id: sanitize(ctx.params.id) }).exec();

			// fail if release doesn't exist
			if (!release) {
				throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
			}
			logger.info(ctx.state, '[ReleaseVersionApi.addVersion] Body: %s', JSON.stringify(ctx.request.body));

			// check permission
			const hasPermission = await this.hasPermission(ctx, release, 'releases', 'update');
			if (!hasPermission) {
				throw new ApiError('Only moderators or authors of the release can add new versions.').status(403).log();
			}

			// set defaults
			const versionObj = defaults(ctx.request.body, { released_at: now }) as ReleaseVersionDocument;
			if (versionObj.files) {
				versionObj.files.forEach(file => {
					defaults(file, { released_at: now });
				});
			}

			// create instance
			newVersion = await state.models.ReleaseVersion.getInstance(ctx.state, versionObj);

			await this.preProcess(ctx, newVersion.getFileIds());

			logger.info(ctx.state, '[ReleaseVersionApi.addVersion] model: %s', JSON.stringify(newVersion));

			let validationErr: any;
			try {
				await newVersion.validate();
			} catch (err) {
				validationErr = err;
			} finally {
				// validate existing version here
				if (release.versions.filter(v => v.version === newVersion.version).length > 0) {
					if (validationErr) {
						validationErr.errors.version = {
							path: 'version',
							message: 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.',
							value: newVersion.version,
						};
					} else {
						throw new ApiError().validationError('version', 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.', newVersion.version);
					}
				}
				if (validationErr) {
					throw validationErr;
				}
			}

			release.versions.push(newVersion);
			release.versions = orderBy(release.versions, ['released_at'], ['desc']);
			release.released_at = release.versions[0].released_at as Date;
			release.modified_at = now;

			logger.info(ctx.state, '[ReleaseApi.addVersion] Validations passed, adding new version to release.');
			release = await release.save();

			await this.postProcess(ctx.state, newVersion.getPlayfieldImageIds());

			logger.info(ctx.state, '[ReleaseApi.create] Added version "%s" to release "%s".', newVersion.version, release.name);
			// set media to active
			await release.activateFiles();

			// game modification date
			await state.models.Game.updateOne({ _id: release._game.toString() }, { modified_at: now });

			logger.info(ctx.state, '[ReleaseApi.create] All referenced files activated, returning object to client.');
			release = await this.getDetails(release._id);

			// log event
			await LogEventUtil.log(ctx, 'create_release_version', true, {
				release: pick(state.serializers.Release.detailed(ctx, release, { thumbFormat: 'medium' }), ['id', 'name', 'authors', 'versions']),
				game: pick(state.serializers.Game.simple(ctx, release._game as GameDocument), ['id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type']),
			}, {
				release: release._id,
				game: release._game._id,
			});

			// invalidate cache
			await apiCache.invalidateUpdatedRelease(ctx.state, release, 'detailed');

			this.success(ctx, state.serializers.Release.detailed(ctx, release).versions.filter(v => v.version === newVersion.version)[0], 201);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// notify (co-)author(s)
			for (const author of release.authors) {
				if ((author._user as UserDocument).id !== ctx.state.user.id) {
					await mailer.releaseVersionAdded(ctx.state, ctx.state.user, author._user as UserDocument, release, newVersion);
				}
			}
		});
	}

	/**
	 * Updates an existing version.
	 *
	 * @see PATCH /v1/releases/:id/versions/:version
	 * @param {Context} ctx Koa context
	 */
	public async updateVersion(ctx: Context) {

		const span = this.apmStartSpan('ReleaseVersionApi.updateVersion');
		let release: ReleaseDocument;
		let version: ReleaseVersionDocument;
		let oldVersion: ReleaseVersionDocument;
		const newFiles: ReleaseVersionFileDocument[] = [];

		try {
			const updatableFields = ['version', 'released_at', 'changes'];
			const updatableFileFields = ['flavor', '_compatibility', '_playfield_image', '_playfield_video'];
			const now = new Date();

			// retrieve release
			release = await state.models.Release.findOne({ id: sanitize(ctx.params.id) })
				.populate('versions.files._compatibility')
				.populate('versions.files._file')
				.exec();

			// fail if no release
			if (!release) {
				throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
			}

			// fail if no version
			version = release.versions.find(v => v.version === ctx.params.version);
			if (!version) {
				throw new ApiError('No such version "%s" for release "%s".', ctx.params.version, ctx.params.id).status(404);
			}

			// check permissions
			const hasPermission = await this.hasPermission(ctx, release, 'releases', 'update');
			if (!hasPermission) {
				throw new ApiError('Only moderators and authors of the release can update a version.').status(403).log();
			}

			// retrieve release with no references that we can update
			const releaseToUpdate = await state.models.Release.findOne({ id: sanitize(ctx.params.id) }).exec();

			const versionToUpdate = releaseToUpdate.versions.find(v => v.version === ctx.params.version);
			oldVersion = cloneDeep(versionToUpdate);

			logger.info(ctx.state, '[ReleaseVersionApi.updateVersion] Body: %s', JSON.stringify(ctx.request.body));

			// validate version string
			if (ctx.request.body.version && release.versions
				.filter(v => !v._id.equals(versionToUpdate._id)) // ignore current
				.find(v => v.version === ctx.request.body.version)) {
					throw new ApiError().validationError('version', 'Provided version already exists and you cannot add a version twice.', ctx.request.body.version);
			}

			for (const fileObj of (ctx.request.body.files || [])) {

				// check if file reference is already part of this version
				const existingVersionFile = version.files.find(f => (f._file as FileDocument).id === fileObj._file);
				if (existingVersionFile) {
					const versionFileToUpdate = versionToUpdate.files.find(f => f._id.equals(existingVersionFile._id));
					await versionFileToUpdate.updateInstance(ctx.state, pick(fileObj, updatableFileFields));

				} else {
					defaults(fileObj, { released_at: now });
					const newVersionFile = await state.models.ReleaseVersionFile.getInstance(ctx.state, fileObj);
					versionToUpdate.files.push(newVersionFile);
					newFiles.push(newVersionFile);
				}
			}

			await this.preProcess(ctx, versionToUpdate.getFileIds().concat(version.getFileIds(newFiles)));

			// assign fields and validate
			Object.assign(versionToUpdate, pick(ctx.request.body, updatableFields));
			try {
				await releaseToUpdate.validate();
			} catch (err) {
				await this.rollbackPreProcess(ctx);
				err.trimFields = /^versions\.\d+\./;
				throw err;
			}

			logger.info(ctx.state, '[ReleaseApi.updateVersion] Validations passed, updating version.');

			releaseToUpdate.versions = orderBy(releaseToUpdate.versions, ['released_at'], ['desc']);
			releaseToUpdate.released_at = releaseToUpdate.versions[0].released_at as Date;
			releaseToUpdate.modified_at = now;
			release = await releaseToUpdate.save();

			await this.postProcess(ctx.state, versionToUpdate.getPlayfieldImageIds());

			if (newFiles.length > 0) {
				logger.info(ctx.state, '[ReleaseApi.updateVersion] Added new file(s) to version "%s" of release "%s".', version.version, release.name);
			}
			const activatedFiles = await release.activateFiles();

			logger.info(ctx.state, '[ReleaseApi.updateVersion] Activated files [ %s ], returning object to client.', activatedFiles.join(', '));
			await state.models.Game.updateOne({ _id: release._game.toString() }, { modified_at: new Date() });

			release = await state.models.Release.findOne({ id: sanitize(ctx.params.id) })
				.populate({ path: '_game' })
				.populate({ path: 'authors._user' })
				.populate({ path: 'versions.files._file' })
				.populate({ path: 'versions.files._playfield_image' })
				.populate({ path: 'versions.files._playfield_video' })
				.populate({ path: 'versions.files._compatibility' })
				.exec();

			version = state.serializers.ReleaseVersion.detailed(ctx, release.versions.find(v => v._id.equals(versionToUpdate._id)));

			// log event
			await LogEventUtil.log(ctx, 'update_release_version', false,
				LogEventUtil.diff(oldVersion, ctx.request.body),
				{ release: release._id, game: release._game._id },
			);

			// invalidate cache
			await apiCache.invalidateUpdatedRelease(ctx.state, release, 'detailed');

			this.success(ctx, version, 200);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// notify (co-)author(s)
			for (const author of release.authors) {
				if ((author._user as UserDocument).id !== ctx.state.user.id) {
					for (const versionFile of newFiles) {
						await mailer.releaseFileAdded(ctx.state, ctx.state.user, author._user as UserDocument, release, version, versionFile);
					}
				}
			}
		});
	}

}
