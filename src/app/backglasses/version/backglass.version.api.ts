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

import { defaults, orderBy, pick } from 'lodash';
import sanitize = require('mongo-sanitize');
import { Api } from '../../common/api';
import { apiCache } from '../../common/api.cache';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { Context } from '../../common/typings/context';
import { GameDocument } from '../../games/game.document';
import { LogEventUtil } from '../../log-event/log.event.util';
import { ReleaseVersionDocument } from '../../releases/version/release.version.document';
import { state } from '../../state';

/* tslint:disable:no-unsafe-finally */
export class BackglassVersionApi extends Api {

	/**
	 * Adds a new version to an existing backglass.
	 *
	 * @see POST /v1/backglasses/:id/versions
	 * @param {Context} ctx Koa context
	 */
	public async addVersion(ctx: Context) {

		const span = this.apmStartSpan('BackglassVersionApi.addVersion');

		try {
			const now = new Date();
			const backglass = await state.models.Backglass.findOne({ id: sanitize(ctx.params.id) }).exec();

			// fail if invalid id
			if (!backglass) {
				throw new ApiError('No such backglass with ID "%s".', ctx.params.id).status(404).log();
			}
			logger.info(ctx.state, '[BackglassVersionApi.addVersion] Body: %s', JSON.stringify(ctx.request.body));

			// check permission
			const hasPermission = await this.hasPermission(ctx, backglass, 'backglasses', 'update');
			if (!hasPermission) {
				throw new ApiError('Only moderators or authors of the backglass can add new versions.').status(403).log();
			}

			// set defaults
			const versionDoc = defaults(ctx.request.body, { released_at: now }) as ReleaseVersionDocument;

			// create instance
			const newVersion = await state.models.BackglassVersion.getInstance(ctx.state, versionDoc);
			logger.info(ctx.state, '[BackglassVersionApi.addVersion] model: %s', JSON.stringify(newVersion));

			// validate
			let validationErr: any;
			try {
				await newVersion.validate();
			} catch (err) {
				validationErr = err;
			} finally {

				// validate existing version here
				const existingVersion = backglass.versions.find(v => v.version === newVersion.version);
				if (existingVersion) {
					validationErr = new ApiError(validationErr).validationError('version', 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.', newVersion.version);
				}

				// validate file type
				if (newVersion._file) {
					const b2sFile = await state.models.File.findById(newVersion._file).exec();
					if (b2sFile && b2sFile.file_type !== 'backglass') {
						validationErr = new ApiError(validationErr).validationError('_file', 'Provided file must be a backglass.', b2sFile.file_type);
					}
				}

				if (validationErr) {
					throw validationErr;
				}
			}

			backglass.versions.push(newVersion);
			backglass.versions = orderBy(backglass.versions, ['released_at'], ['desc']);
			backglass.created_at = backglass.versions[0].released_at as Date;

			logger.info(ctx.state, '[BackglassVersionApi.addVersion] Validations passed, adding new version to backglass.');
			await backglass.save();

			logger.info(ctx.state, '[BackglassVersionApi.create] Added version "%s" to backglass "%s".', newVersion.version, backglass.id);
			// set media to active
			await backglass.activateFiles();

			// game modification date
			await state.models.Game.updateOne({ _id: backglass._game.toString() }, { modified_at: now });

			logger.info(ctx.state, '[BackglassVersionApi.create] All referenced files activated, returning object to client.');
			const populatedBackglass = await state.models.Backglass.findById(backglass._id)
				.populate({ path: '_game' })
				.populate({ path: 'authors._user' })
				.populate({ path: 'versions._file' })
				.populate({ path: '_created_by' })
				.exec();

			// log event
			await LogEventUtil.log(ctx, 'create_backglass_version', true, {
				release: pick(state.serializers.Backglass.detailed(ctx, populatedBackglass, { thumbFormat: 'medium' }), ['id', 'authors', 'versions']),
				game: pick(state.serializers.Game.simple(ctx, populatedBackglass._game as GameDocument), ['id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type']),
			}, {
				backglass: populatedBackglass._id,
				game: populatedBackglass._game._id,
			});

			// invalidate cache
			await apiCache.invalidateUpdatedBackglass(ctx.state, populatedBackglass);

			this.success(ctx, state.serializers.Backglass.detailed(ctx, populatedBackglass).versions.find(v => v.version === newVersion.version), 201);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}
}
