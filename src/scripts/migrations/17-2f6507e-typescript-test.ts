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

import { apiCache } from '../../app/common/api.cache';
import { logger } from '../../app/common/logger';
import { state } from '../../app/state';

/**
 * This is a test script that works with Typescript.
 */
export async function up() {

	// db test
	const count = await state.models.User.countDocuments({});
	logger.info(null, '[migrate-17] There are currently %s users in the database.', count);

	// code test
	await apiCache.invalidateAll();
	logger.info(null, '[migrate-17] Cache invalidated.');
}
