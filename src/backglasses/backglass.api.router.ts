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

import { StarApi } from '../stars/star.api';
import { BackglassApi } from './backglass.api';

const api = new BackglassApi();
const starApi = new StarApi();

export const backglassApiRouter = api.apiRouter();

backglassApiRouter.get('/v1/backglasses',       api.list.bind(api));
backglassApiRouter.post('/v1/backglasses',       api.auth(api.create.bind(api), 'backglasses', 'add', [ Scope.ALL, Scope.CREATE ]));
backglassApiRouter.get('/v1/backglasses/:id',   api.view.bind(api));
backglassApiRouter.patch('/v1/backglasses/:id',  api.auth(api.update.bind(api), 'backglasses', 'update-own', [ Scope.ALL, Scope.CREATE ]));
backglassApiRouter.delete('/v1/backglasses/:id', api.auth(api.del.bind(api), 'backglasses', 'delete-own', [ Scope.ALL, Scope.CREATE ]));

backglassApiRouter.post('/v1/backglasses/:id/star',   api.auth(starApi.star('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
backglassApiRouter.delete('/v1/backglasses/:id/star', api.auth(starApi.unstar('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
backglassApiRouter.get('/v1/backglasses/:id/star',    api.auth(starApi.get('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

backglassApiRouter.post('/v1/backglasses/:id/moderate', api.auth(api.moderate.bind(api), 'backglasses', 'moderate', [ Scope.ALL ]));
