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

const api = new FileApi();
export const router = api.storageRouter();
export const prefixes = [ '/v1/files' ];

router.post('/v1/files',                      api.auth(api.upload.bind(api), 'files', 'upload', [ Scope.ALL ]));
// router.head('/v1/files/:id.[^/]+',            api.anon(storage.files.head));
// router.head('/v1/files/:variation/:id.[^/]+', api.anon(storage.files.head));
// router.get('/v1/files/:id.[^/]+',             api.anon(storage.files.get));  // permission/quota handling is inside.
// router.get('/v1/files/:variation/:id.[^/]+',  api.anon(storage.files.get));

// nginx is taking care of this in production
// router.head(settings.storagePublicPath('/files/:id.[^/]+'),            api.anon(storage.files.head));
// router.head(settings.storagePublicPath('/files/:variation/:id.[^/]+'), api.anon(storage.files.head));
// router.get(settings.storagePublicPath('/files/:id.[^/]+'),             api.anon(storage.files.get));  // permission/quota handling is inside.
// router.get(settings.storagePublicPath('/files/:variation/:id.[^/]+'),  api.anon(storage.files.get));
