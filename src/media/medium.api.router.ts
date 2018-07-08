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
import { MediumApi } from './medium.api';

const api = new MediumApi();
const starApi = new StarApi();

export const mediumApiRouter = api.apiRouter();

mediumApiRouter.post('/v1/media',       api.auth(api.create.bind(api), 'media', 'add', [Scope.ALL, Scope.CREATE]));
mediumApiRouter.delete('/v1/media/:id', api.auth(api.del.bind(api), 'media', 'delete-own', [Scope.ALL, Scope.CREATE]));

mediumApiRouter.post('/v1/media/:id/star',   starApi.auth(starApi.star('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
mediumApiRouter.delete('/v1/media/:id/star', starApi.auth(starApi.unstar('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
mediumApiRouter.get('/v1/media/:id/star',    starApi.auth(starApi.get('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
