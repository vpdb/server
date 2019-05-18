/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { logger } from '../../app/common/logger';
import { state } from '../../app/state';

/**
 * Sets the new is_deleted moderation status to false for all entities.
 */
export async function up() {

	// migrate releases
	logger.info(null, '[migrate-21] Setting is_deleted moderation status of releases to false...');
	await state.models.Release.updateMany({}, { $set: { 'moderation.is_deleted': false } });

	// migrate backglasses
	logger.info(null, '[migrate-21] Setting is_deleted moderation status of backglases to false...');
	await state.models.Backglass.updateMany({}, { $set: { 'moderation.is_deleted': false } });

	logger.info(null, '[migrate-21] All done.');
}
