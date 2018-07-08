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
import { LogEventApi } from '../log-event/log.event.api';
import { StarApi } from '../stars/star.api';
import { UserApi } from './user.api';

const api = new UserApi();
const starApi = new StarApi();
const eventApi = new LogEventApi();
export const userApiRouter = api.apiRouter();

userApiRouter.post('/v1/users',   api.create.bind(api));
userApiRouter.put('/v1/users',     api.auth(api.createOrUpdate.bind(api), '', '', [ Scope.SERVICE ]));
userApiRouter.get('/v1/users',     api.auth(api.list.bind(api), 'users', 'search', [ Scope.ALL ]));
userApiRouter.get('/v1/users/:id', api.auth(api.view.bind(api), 'users', 'view', [ Scope.ALL ]));
userApiRouter.put('/v1/users/:id', api.auth(api.update.bind(api), 'users', 'update', [ Scope.ALL ]));
userApiRouter.del('/v1/users/:id', api.auth(api.del.bind(api), 'users', 'delete', [ Scope.ALL ]));

userApiRouter.post('/v1/users/:id/star',   api.auth(starApi.star('user').bind(starApi), 'users', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
userApiRouter.del('/v1/users/:id/star', api.auth(starApi.unstar('user').bind(starApi), 'users', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
userApiRouter.get('/v1/users/:id/star',    api.auth(starApi.get('user').bind(starApi), 'users', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

userApiRouter.get('/v1/users/:id/events',            eventApi.list({ byActor: true }).bind(eventApi));
userApiRouter.post('/v1/users/:id/send-confirmation', api.auth(api.sendConfirmationMail.bind(api), 'users', 'send-confirmation', [ Scope.ALL ]));
