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
import { RomApi } from './rom.api';

const api = new RomApi();
export const router = api.apiRouter();

router.get('/v1/roms', api.anon(api.list.bind(api)));
router.post('/v1/roms', api.auth(api.create.bind(api), 'roms', 'add', [ Scope.ALL , Scope.CREATE ]));
router.get('/v1/roms/:id',  api.anon(api.view.bind(api)));
router.delete('/v1/roms/:id',  api.auth(api.del.bind(api), 'roms', 'delete-own', [ Scope.ALL , Scope.CREATE ]));

router.get('/v1/games/:gameId/roms', api.anon(api.list.bind(api)));
router.post('/v1/games/:gameId/roms', api.auth(api.create.bind(api), 'roms', 'add', [ Scope.ALL , Scope.CREATE ]));
