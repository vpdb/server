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

import { apiCache } from '../../app/common/api.cache';
import { logger } from '../../app/common/logger';
import { state } from '../../app/state';

/**
 * Updates most ROM files with the type, so we know which is the main ROM,
 * which is the sound ROM etc.
 *
 * @see https://github.com/vpdb/vpx-js/issues/130
 */
export async function up() {

	// read the parsed types
	const romTypes = require('../../../data/rom-types.json');

	// fetch all roms
	const roms = await state.models.Rom.find({}).exec();
	logger.info(null, '[migrate-23] Updating %s ROMs with file types...', roms.length);

	// loop through roms and rom files
	let count = 0;
	for (const rom of roms) {
		if (!romTypes[rom.id]) {
			continue;
		}
		for (const romFile of rom.rom_files) {
			const romType = romTypes[rom.id][romFile.filename.toLowerCase()];
			if (!romType) {
				continue;
			}

			// update with new data
			romFile.type = romType.type;
			if (romType.romType) {
				romFile.system = romType.romType;
			}
			count++;
		}
		await rom.save();
	}
	logger.info(null, '[migrate-23] Updated %s ROM files!', count);

	// clear all caches
	await apiCache.invalidateAll();
	logger.info(null, '[migrate-23] Cache invalidated.');
}
