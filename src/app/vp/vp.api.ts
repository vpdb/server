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

import { inspect } from 'util';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { VpTable } from '../vpinball/vp-table';

export class VpApi extends Api {

	/**
	 * Returns all primitives of the vpx file
	 *
	 * @see GET /v1/vp/:fileId
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		const vptFile = await this.getVpFile(ctx);
		const vpTable = await this.getVpTable(ctx, vptFile);

		// tslint:disable-next-line:no-console
		console.log(inspect(vpTable.getPrimitive('Joker'), { colors: true, depth: null }));

		this.success(ctx, vpTable.serialize(vptFile.id), 200);
	}

	/**
	 * Returns the mesh of a primitive.
	 *
	 * @see GET /v1/vp/:fileId/meshes/:meshName.obj
	 * @param {Context} ctx Koa context
	 */
	public async getMeshObj(ctx: Context) {

		const vptFile = await this.getVpFile(ctx);

		const redisKey = `api-cache-vpt:mesh:${vptFile.id}:${ctx.params.meshName}`;
		let obj = await state.redis.get(redisKey);
		if (!obj) {
			const vpTable = await this.getVpTable(ctx, vptFile);
			const mesh = vpTable.getPrimitive(ctx.params.meshName);
			if (!mesh) {
				throw new ApiError('No primitive named "%s" in this table!').status(404);
			}
			obj = mesh.serializeToObj();
			await state.redis.set(redisKey, obj);
		}

		ctx.status = 200;
		ctx.set('Content-Type', 'text/plain');
		ctx.response.body = obj;
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

	private async getVpTable(ctx: Context, vptFile: FileDocument): Promise<VpTable> {
		let vpTable: VpTable;
		const redisKey = `api-cache-vpt:data:${vptFile.id}`;
		const cachedVpTable = await state.redis.get(redisKey);
		if (!cachedVpTable) {
			vpTable = await VpTable.load(vptFile.getPath(ctx.state));
			await state.redis.set(redisKey, JSON.stringify(vpTable));
		} else {
			vpTable = VpTable.from(JSON.parse(cachedVpTable));
		}
		return vpTable;
	}
}
