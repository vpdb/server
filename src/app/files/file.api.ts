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

import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { Context } from '../common/typings/context';
import { state } from '../state';
import { FileStorage } from './file.storage';

/**
 * The file API deals only with the files' meta data. For uploading and
 * downloading the actual files, see {@link FileStorage}.
 */
export class FileApi extends Api {

	/**
	 * Deletes a file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async del(ctx: Context) {
		const file = await state.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if not owner
		if (!file._created_by._id.equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}

		// only allow inactive files (for now)
		if (file.is_active !== false) {
			throw new ApiError('Cannot remove active file.').status(400);
		}
		await file.remove();

		logger.info(ctx.state, '[FileApi.del] File "%s" (%s) successfully removed.', file.name, file.id);
		return this.success(ctx, null, 204);
	}

	/**
	 * Returns details of a given file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async view(ctx: Context) {
		const file = await state.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if inactive and not owner
		const isOwner = ctx.state.user && file._created_by._id.equals(ctx.state.user._id);
		if (!file.is_active && (!ctx.state.user || !isOwner)) {
			throw new ApiError('File "%s" is inactive.', ctx.params.id).status(ctx.state.user ? 403 : 401);
		}
		return this.success(ctx, state.serializers.File.detailed(ctx, file));
	}

}
