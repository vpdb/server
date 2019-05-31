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
import { Scope } from '../common/scope';
import { FileStorage } from './file.storage';

export class FileProtectedStorageRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const storage = new FileStorage();
		this.router = storage.storageRouter(true);

		this.router.post('/v1/files',                  storage.auth(storage.upload.bind(storage), 'files', 'upload', [ Scope.ALL ]));
		this.router.head('/files/:id.:ext',            storage.auth(storage.head.bind(storage), 'files', 'download', [ Scope.ALL, Scope.STORAGE ]));
		this.router.head('/files/:variation/:id.:ext', storage.auth(storage.head.bind(storage), 'files', 'download', [ Scope.ALL, Scope.STORAGE ]));
		this.router.get('/files/:id.:ext',             storage.auth(storage.get.bind(storage), 'files', 'download', [ Scope.ALL, Scope.STORAGE ]));
		this.router.get('/files/:variation/:id.:ext',  storage.auth(storage.get.bind(storage), 'files', 'download', [ Scope.ALL, Scope.STORAGE ]));
		this.router.get('/files/:id.zip/:filepath',   storage.zipStream.bind(storage));
	}

	public getRouter(): Router {
		return this.router;
	}
}

export class FilePublicStorageRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const storage = new FileStorage();
		this.router = storage.storageRouter(false);

		// this is usually handled by nginx directly, but might be used as fallback when there's no file before processors finish.
		this.router.head('/files/:id.:ext',            storage.head.bind(storage));
		this.router.head('/files/:variation/:id.:ext', storage.head.bind(storage));
		this.router.get('/files/:id.:ext',             storage.get.bind(storage));
		this.router.get('/files/:variation/:id.:ext',  storage.get.bind(storage));
	}

	public getRouter(): Router {
		return this.router;
	}
}
