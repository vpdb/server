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

import { Scope } from '../common/scope';
import { FileApi } from './file.api';
import { FileStorage } from './file.storage';

const api = new FileApi();
const storage = new FileStorage();
export const protectedRouter = api.storageRouter(true);
export const publicRouter = api.storageRouter(false);

protectedRouter.post('/v1/files',                  api.auth(api.upload.bind(api), 'files', 'upload', [ Scope.ALL ]));
protectedRouter.head('/files/:id.:ext',            storage.auth(storage.head.bind(storage), 'files', 'download', [ Scope.ALL ]));
protectedRouter.head('/files/:variation/:id.:ext', storage.auth(storage.head.bind(storage), 'files', 'download', [ Scope.ALL ]));
protectedRouter.get('/files/:id.:ext',             storage.auth(storage.get.bind(storage), 'files', 'download', [ Scope.ALL ]));
protectedRouter.get('/files/:variation/:id.:ext',  storage.auth(storage.get.bind(storage), 'files', 'download', [ Scope.ALL ]));

// this is usually handled by nginx directly, but might be used as fallback when there's no file before processors finish.
publicRouter.head('/files/:id.:ext',            storage.head.bind(storage));
publicRouter.head('/files/:variation/:id.:ext', storage.head.bind(storage));
publicRouter.get('/files/:id.:ext',             storage.get.bind(storage));
publicRouter.get('/files/:variation/:id.:ext',  storage.get.bind(storage));
