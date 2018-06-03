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
import { TagApi } from './tag.api';

const api = new TagApi();
export const router = api.apiRouter();

router.get('/v1/tags',        api.anon(api.list.bind(api)));
router.post('/v1/tags',       api.auth(api.create.bind(api), 'tags', 'add', [Scope.ALL, Scope.CREATE]));
router.delete('/v1/tags/:id', api.auth(api.del.bind(api), 'tags', 'delete-own', [Scope.ALL, Scope.CREATE]));