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

protectedRouter.post('/v1/files',                      api.auth(api.upload.bind(api), 'files', 'upload', [ Scope.ALL ]));
protectedRouter.head('/v1/files/:id.[^/]+',            api.anon(storage.head.bind(storage)));
protectedRouter.head('/v1/files/:variation/:id.[^/]+', api.anon(storage.head.bind(storage)));
protectedRouter.get('/v1/files/:id.[^/]+',             api.anon(storage.get.bind(storage)));  // permission/quota handling is inside.
protectedRouter.get('/v1/files/:variation/:id.[^/]+',  api.anon(storage.get.bind(storage)));

// this is usually handled by nginx directly, but might be used as fallback when there's no file before processors finish.
publicRouter.head('/files/:id.[^/]+',            api.anon(storage.head.bind(storage)));
publicRouter.head('/files/:variation/:id.[^/]+', api.anon(storage.head.bind(storage)));
publicRouter.get('/files/:id.[^/]+',             api.anon(storage.get.bind(storage)));  // permission/quota handling is inside.
publicRouter.get('/files/:variation/:id.[^/]+',  api.anon(storage.get.bind(storage)));
