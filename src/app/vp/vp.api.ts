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
import { OleCompoundDoc } from '../common/ole-doc';
import { Context } from '../common/typings/context';
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { GameData } from '../vpinball/game-data';
import { GameItem } from '../vpinball/game-item';
import { Mesh } from '../vpinball/mesh';
import { bulbLightMesh } from '../vpinball/meshes/bulb-light-mesh';
import { PrimitiveItem } from '../vpinball/primitive-item';
import { RubberItem } from '../vpinball/rubber-item';
import { Texture } from '../vpinball/texture';
import { VpTable } from '../vpinball/vp-table';
import { logger } from '../common/logger';

export class VpApi extends Api {

	private static cacheGlb = true;
	private static cacheMeta = true;

	/**
	 * Returns all primitives of the vpx file
	 *
	 * @see GET /v1/vp/:fileId
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		const vptFile = await this.getVpFile(ctx);
		const vpTable = await VpTable.load(vptFile.getPath(ctx.state));

		this.success(ctx, vpTable.serialize(vptFile.id), 200);
	}

	public async viewGlb(ctx: Context) {
		let glb: Buffer = null;
		const redisKey = `api-cache-vpt:glb:${ctx.params.fileId}`;
		if (VpApi.cacheGlb) {
			const data = await state.redis.get(redisKey);
			if (data) {
				glb = Buffer.from(data, 'base64');
			}
			logger.info(ctx.state, '[VpApi.viewGlb] Cache "%s" returned %s bytes', redisKey, glb ? glb.length : 0);
		}
		if (!glb) {
			const vptFile = await this.getVpFile(ctx);
			const vpTable = await VpTable.load(vptFile.getPath(ctx.state));
			glb = await vpTable.exportGlb();

			if (VpApi.cacheGlb) {
				logger.info(ctx.state, '[VpApi.viewGlb] Saving to cache "%s"...', redisKey, glb ? glb.length : 0);
				await state.redis.set(redisKey, glb.toString('base64'));
			}
		}
		ctx.status = 200;
		ctx.set('Content-Type', 'model/gltf-binary');
		ctx.response.body = glb;
	}

	public async viewGltf(ctx: Context) {
		const vptFile = await this.getVpFile(ctx);
		const vpTable = await VpTable.load(vptFile.getPath(ctx.state));
		const gltf = await vpTable.exportGltf();
		ctx.status = 200;
		ctx.set('Content-Type', 'model/gltf+json');
		ctx.response.body = gltf;
	}

	/**
	 * Returns the mesh of a primitive.
	 *
	 * @see GET /v1/vp/:fileId/meshes/:meshName.obj
	 * @param {Context} ctx Koa context
	 */
	public async getMeshObj(ctx: Context) {

		// const vptFile = await this.getVpFile(ctx);
		//
		// let obj: string;
		// if (VpApi.cacheObj) {
		// 	const redisKey = `api-cache-vpt:mesh:${vptFile.id}:${ctx.params.meshName}`;
		// 	obj = await state.redis.get(redisKey);
		// 	if (!obj) {
		// 		const vpTable = await this.getVpTable(ctx, vptFile);
		// 		const mesh = vpTable.getPrimitive(ctx.params.meshName);
		// 		if (!mesh) {
		// 			throw new ApiError('No primitive named "%s" in this table!', ctx.params.meshName).status(404);
		// 		}
		// 		//obj = mesh.serializeToObj();
		// 		await state.redis.set(redisKey, obj);
		// 	}
		// } else {
		// 	const doc = new OleCompoundDoc(vptFile.getPath(ctx.state));
		// 	await doc.read();
		// 	const gameStorage = doc.storage('GameStg');
		// 	const gameData = await GameData.fromStorage(gameStorage, 'GameData');
		// 	let primitive: PrimitiveItem;
		// 	for (let i = 0; i < gameData.numGameItems; i++) {
		// 		const itemName = `GameItem${i}`;
		// 		const itemData = await gameStorage.read(itemName, 0, 4);
		// 		const itemType = itemData.readInt32LE(0);
		// 		if (itemType !== GameItem.TypePrimitive) {
		// 			continue;
		// 		}
		// 		primitive = await PrimitiveItem.fromStorage(gameStorage, itemName);
		// 		if (primitive.getName() === ctx.params.meshName) {
		// 			break;
		// 		}
		// 	}
		// 	if (!primitive) {
		// 		throw new ApiError('No primitive named "%s" in this table!', ctx.params.meshName).status(404);
		// 	}
		// 	//obj = primitive.serializeToObj();
		// }
		//
		// ctx.status = 200;
		// ctx.set('Content-Type', 'text/plain');
		// ctx.response.body = obj;
	}

	/**
	 * Returns the mesh of a primitive.
	 *
	 * @see GET  /v1/meshes/:meshName.obj
	 * @param {Context} ctx Koa context
	 */
	public async getLocalMeshObj(ctx: Context) {

		const meshes: { [key: string]: Mesh } = {
			bulbLightMess: bulbLightMesh,
		};

		if (!meshes[ctx.params.meshName]) {
			throw new ApiError('There is no global mesh named "%s"!', ctx.params.meshName).status(404);
		}
		const mesh: Mesh = meshes[ctx.params.meshName];
		const obj = mesh.serializeToObj(ctx.params.meshName);
		ctx.status = 200;
		ctx.set('Content-Type', 'text/plain');
		ctx.response.body = obj;
	}

	/**
	 * Streams an image from the vpx file to the browser
	 * @see GET /v1/vp/:fileId/images/:imageNum/:pos/:len
	 * @param ctx
	 */
	public async getImage(ctx: Context) {
		const vptFile = await this.getVpFile(ctx);
		const doc = new OleCompoundDoc(vptFile.getPath(ctx.state));
		await doc.read();

		// TODO validations

		ctx.status = 200;
		ctx.respond = false;
		ctx.set('Content-Type', 'image/png'); // pre-analyze and read from data
		doc
			.storage('GameStg')
			.stream(`Image${ctx.params.imageNum}`, parseInt(ctx.params.pos, 16), parseInt(ctx.params.len, 16))
			.on('end', () => doc.close())
			.on('error', () => doc.close())
			.pipe(ctx.res);
	}

	/**
	 * Returns texture map inside of an .vpt file.
	 *
	 * @see GET /v1/vp/:fileId/textures/:textureName
	 * @param {Context} ctx Koa context
	 */
	public async getTexture(ctx: Context) {

		// const vptFile = await this.getVpFile(ctx);
		// const doc = new OleCompoundDoc(vptFile.getPath(ctx.state));
		// await doc.read();
		//
		// let texture: Texture;
		// if (VpApi.cacheVpx) {
		// 	const redisKey = `api-cache-vpt:texture:${vptFile.id}:${ctx.params.textureName}`;
		// 	const textureInfo = await state.redis.get(redisKey);
		// 	if (!textureInfo) {
		// 		const vpTable = await this.getVpTable(ctx, vptFile);
		// 		texture = vpTable.getTexture(ctx.params.textureName);
		// 		if (!texture) {
		// 			throw new ApiError('No texture named "%s" in this table!').status(404);
		// 		}
		// 		await state.redis.set(redisKey, JSON.stringify(texture));
		// 	} else {
		// 		texture = JSON.parse(textureInfo);
		// 	}
		//
		// } else {
		// 	const gameStorage = doc.storage('GameStg');
		// 	const gameData = await GameData.fromStorage(gameStorage, 'GameData');
		// 	for (let i = 0; i < gameData.numTextures; i++) {
		// 		const itemName = `Image${i}`;
		// 		texture = await Texture.fromStorage(gameStorage, itemName);
		// 		if (texture.getName() === ctx.params.textureName) {
		// 			break;
		// 		}
		// 	}
		// 	if (!texture) {
		// 		throw new ApiError('No texture named "%s" in this table!').status(404);
		// 	}
		// }
		//
		// if (!texture.binary) {
		// 	throw new ApiError('Texture does not contain any data.').status(400);
		// }
		//
		// ctx.status = 200;
		// ctx.respond = false;
		// ctx.set('Content-Type', 'image/png'); // pre-analyze and read from data
		// doc
		// 	.storage('GameStg')
		// 	.stream(texture.storageName, texture.binary.pos, texture.binary.len)
		// 	.on('end', () => doc.close())
		// 	.on('error', () => doc.close())
		// 	.pipe(ctx.res);
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

	// private async getVpTable(ctx: Context, vptFile: FileDocument): Promise<VpTable> {
	// 	let vpTable: VpTable;
	// 	if (VpApi.cacheVpx) {
	// 		const redisKey = `api-cache-vpt:data:${vptFile.id}`;
	// 		const cachedVpTable = await state.redis.get(redisKey);
	// 		if (!cachedVpTable) {
	// 			vpTable = await VpTable.load(vptFile.getPath(ctx.state));
	// 			await state.redis.set(redisKey, JSON.stringify(vpTable));
	// 		} else {
	// 			vpTable = VpTable.from(JSON.parse(cachedVpTable));
	// 		}
	// 	} else {
	// 		vpTable = await VpTable.load(vptFile.getPath(ctx.state));
	// 	}
	// 	return vpTable;
	// }
}
