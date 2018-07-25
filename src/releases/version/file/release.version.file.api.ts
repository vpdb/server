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

import { Api } from '../../../common/api';
import { apiCache } from '../../../common/api.cache';
import { ApiError } from '../../../common/api.error';
import { logger } from '../../../common/logger';
import { mailer } from '../../../common/mailer';
import { Context } from '../../../common/typings/context';
import { FileDocument } from '../../../files/file.document';
import { GameDocument } from '../../../games/game.document';
import { LogEventUtil } from '../../../log-event/log.event.util';
import { state } from '../../../state';
import { UserDocument } from '../../../users/user.document';

export class ReleaseVersionFileApi extends Api {

	/**
	 * Marks a release file as validated.
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
		let versionFile = version.files.find(f => (f._file as FileDocument).id === ctx.params.file);
		if (!versionFile) {
			throw new ApiError('No file with ID "%s" for version "%s" of release "%s".', ctx.params.file, ctx.params.version, ctx.params.id).status(404);
		}
		const versionFileId = versionFile._id;

		// validations
		const validationErrors = [];
		if (!ctx.request.body.message) {
			validationErrors.push({
				path: 'message',
				message: 'A message must be provided.',
				value: ctx.request.body.message,
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
		const fileToUpdate = versionToUpdate.files.find(f => f._id.equals(versionFileId));

		fileToUpdate.validation = {
			status: ctx.request.body.status,
			message: ctx.request.body.message,
			validated_at: now,
			_validated_by: ctx.state.user._id,
		};

		try {
			await releaseToUpdate.save();

		} catch (err) {
			err.trimFields = /^versions\.\d+\.files\.\d+\.validation\./;
			throw err;
		}

		// invalidate cache
		await apiCache.invalidateRelease(ctx.state, releaseToUpdate);

		logger.info(ctx.state, '[ReleaseApi.validateFile] Updated file validation status.');

		release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate({ path: '_created_by' })
			.populate({ path: '_game' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files.validation._validated_by' })
			.exec();

		version = release.versions.find(v => v.version === ctx.params.version);
		versionFile = version.files.find(f => (f._file as FileDocument).id === ctx.params.file);

		this.success(ctx, state.serializers.ReleaseVersionFile.detailed(ctx, versionFile).validation, 200);

		// log event
		await LogEventUtil.log(ctx, 'validate_release', false,
			{ validation: versionFile.validation },
			{ release: release._id, game: release._game._id },
		);

		await mailer.releaseValidated(ctx.state, release._created_by as UserDocument, ctx.state.user, release._game as GameDocument, release, state.serializers.ReleaseVersionFile.detailed(ctx, versionFile));
	}
}
