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

import * as Router from 'koa-router';
import { ApiRouter } from '../common/api.router';
import { VpApi } from './vp.api';

export class VpApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new VpApi();
		this.router = api.apiRouter();

		this.router.get('/v1/vp/:fileId', api.view.bind(api));
		this.router.get('/v1/vp/:fileId/objects.glb', api.viewGlb.bind(api));
		this.router.get('/v1/vp/:fileId/objects.gltf', api.viewGltf.bind(api));
		this.router.get('/v1/vp/:fileId/images/:imageNum/:pos/:len', api.getImage.bind(api));

		this.router.get('/v1/vp/:fileId/meshes/:meshName.obj', api.getMeshObj.bind(api));
		this.router.get('/v1/vp/:fileId/textures/:textureName', api.getTexture.bind(api));
		this.router.get('/v1/meshes/:meshName.obj', api.getLocalMeshObj.bind(api));
	}

	public getRouter(): Router {
		return this.router;
	}
}