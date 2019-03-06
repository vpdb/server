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
import { Context } from '../common/typings/context';
import { state } from '../state';
import { ApiError } from '../common/api.error';
import { FileDocument } from '../files/file.document';
import { VpTable } from '../vpinball/vp-table';
import { inspect } from 'util';

export class VpApi extends Api {

	/**
	 * Returns all primitives of the vpx file
	 *
	 * @see GET /v1/vp/:fileId/meshes
	 * @param {Context} ctx Koa context
	 */
	public async getMeshes(ctx: Context) {

		const vptFile = await this.getVpFile(ctx);
		const vpTable = await VpTable.load(vptFile.getPath(ctx.state));

		//console.log(inspect(vpTable, {colors: true, depth: null }));

		this.success(ctx, vpTable.serialize(), 200);
	}

	/**
	 * Returns the mesh of a primitive.
	 *
	 * @see GET /v1/vp/:fileId/meshes/:meshName
	 * @param {Context} ctx Koa context
	 */
	public async getMesh(ctx: Context) {

		this.success(ctx, {}, 200);
	}


	private async getVpFile(ctx: Context): Promise<FileDocument> {
		const file = await state.models.File.findOne({ id: ctx.params.fileId });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.fileId).status(404);
		}

		// fail if not a vpx
		if (!file.mime_type.startsWith('application/x-visual-pinball-table')) {
			throw new ApiError('Not a .vpx/.vpt table file.', ctx.params.fileId).status(400);
		}
		return file;
	}
}
