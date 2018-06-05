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

import Application = require('koa');
import mongoose, { Schema } from 'mongoose';
import Router from 'koa-router';

import { state } from '../state';
import { EndPoint } from '../common/types/endpoint';
import { ReleaseSerializer } from './release.serializer';
import { TableBlock } from './release.tableblock';
import { tableBlockSchema } from './release.tableblock.schema';
import { Release } from './release';
import { ReleaseModel, releaseSchema } from './release.schema';
import { ReleaseVersionModel, releaseVersionSchema } from './release.version.schema';
import { ReleaseVersionFileModel, releaseVersionFileSchema } from './release.version.file.schema';
import { ReleaseVersion } from './release.version';
import { ReleaseVersionFile } from './release.version.file';
import { router as apiRouter } from './release.api.router';
import { router as storageRouter } from './release.storage.router';
import { ReleaseVersionSerializer } from './release.version.serializer';
import { ReleaseVersionFileSerializer } from './release.version.file.serializer';
import { apiCache } from '../common/api.cache';

export class ReleaseEndPoint implements EndPoint {

	readonly name: string = 'Release API';

	private readonly _router: Router;
	private readonly _releaseSchema: Schema;
	private readonly _releaseVersionSchema: Schema;
	private readonly _releaseVersionFileSchema: Schema;

	constructor() {
		this._router = apiRouter;
		this._releaseSchema = releaseSchema;
		this._releaseVersionSchema = releaseVersionSchema;
		this._releaseVersionFileSchema = releaseVersionFileSchema;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		state.models.Release = mongoose.model<Release>('Release', this._releaseSchema) as ReleaseModel;
		state.models.ReleaseVersion = mongoose.model<ReleaseVersion, ReleaseVersionModel>('ReleaseVersion', this._releaseVersionSchema);
		state.models.ReleaseVersionFile = mongoose.model<ReleaseVersionFile, ReleaseVersionFileModel>('ReleaseVersionFile', this._releaseVersionFileSchema);
		state.serializers.Release = new ReleaseSerializer();
		state.serializers.ReleaseVersion = new ReleaseVersionSerializer();
		state.serializers.ReleaseVersionFile = new ReleaseVersionFileSerializer();
		state.models.TableBlock = mongoose.model<TableBlock>('TableBlock', tableBlockSchema);

		apiCache.enable(this._router, '/v1/releases', { resources: [ 'release', 'user' ] });
		apiCache.enable(this._router, '/v1/releases/:id',  { entities: { release: 'id' } });
		apiCache.enable(this._router, '/v1/releases/:id/comments', { entities: { release: 'id' } });
		//apiCache.enable(this._router, '/v1/releases/:id/events');
	}
}

export class ReleaseStorageEndPoint implements EndPoint {

	readonly name: string = 'Release storage API';

	private readonly _router: Router;

	constructor() {
		this._router = storageRouter;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		// nothing to register
	}
}