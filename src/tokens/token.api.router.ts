/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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
import { TokenApi } from './token.api';

const api = new TokenApi();
export const router = api.apiRouter();

router.post('/v1/tokens', api.auth(api.create.bind(api), 'tokens', 'add', [ Scope.ALL ]));
router.get('/v1/tokens', api.auth(api.list.bind(api), 'tokens', 'list', [ Scope.ALL ], { enableAppTokens: true }));
router.get('/v1/tokens/:id', api.anon(api.view.bind(api)));
router.del('/v1/tokens/:id', api.auth(api.del.bind(api), 'tokens', 'delete-own', [ Scope.ALL ]));
router.patch('/v1/tokens/:id', api.auth(api.update.bind(api), 'tokens', 'update-own', [ Scope.ALL ]));