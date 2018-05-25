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

import { MiscApi } from './misc.api';

const api = new MiscApi();
export const router = api.apiRouter();

router.get('index', '/v1',  api.anon(api.index.bind(api)));
router.get('/v1/ping',           api.ping.bind(api));

if (process.env.ENABLE_KILL_SWITCH) {
	router.post('/v1/kill',       api.kill.bind(api));
}

router.redirect('/', 'index');
