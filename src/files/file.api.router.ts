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
export const router = api.apiRouter();
export const prefixes = [ '/v1/files' ];

router.get('/v1/files/:id',            api.anon(api.files.view.bind(api)));
router.del('/v1/files/:id',            api.auth(api.files.del.bind(api), 'files', 'delete-own', [ Scope.ALL, Scope.CREATE ]));
router.get('/v1/files/:id/blockmatch', api.auth(api.files.blockmatch.bind(api), 'files', 'blockmatch', [ Scope.ALL, Scope.CREATE ]));
