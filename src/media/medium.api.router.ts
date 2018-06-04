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
import { MediumApi } from './medium.api';

const api = new MediumApi();
export const router = api.apiRouter();

router.post('/v1/media',       api.auth(api.create.bind(api), 'media', 'add', [Scope.ALL, Scope.CREATE]));
router.delete('/v1/media/:id', api.auth(api.del.bind(api), 'media', 'delete-own', [Scope.ALL, Scope.CREATE]));

// router.post(settings.apiPath('/media/:id/star'),   api.auth(api.stars.star('medium'), 'media', 'star', [ scope.ALL, scope.COMMUNITY ]));
// router.delete(settings.apiPath('/media/:id/star'), api.auth(api.stars.unstar('medium'), 'media', 'star', [ scope.ALL, scope.COMMUNITY ]));
// router.get(settings.apiPath('/media/:id/star'),    api.auth(api.stars.get('medium'), 'media', 'star', [ scope.ALL, scope.COMMUNITY ]));