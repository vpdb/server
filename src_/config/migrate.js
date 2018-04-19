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

'use strict';

const path = require('path');
const logger = require('winston');
let settings;
try {
	settings = require(path.resolve(__dirname, '../modules/settings'));
} catch (e) {
	logger.error('[settings] Migration failed!');
	process.exit(2);
}
settings.migrate(function(result) {
	if (result.errors.length > 0) {
		return process.exit(2);
	}
	const importantSettings = [];
	for (let i = 0; i < result.added.length; i++) {
		if (result.added[i].important) {
			importantSettings.push(result.added[i].path);
		}
	}
	if (importantSettings.length > 0) {
		logger.warn('[settings] New important setting%s: [%s]', importantSettings.length === 1 ? '' : 's', importantSettings.join(', '));
		return process.exit(1);
	}
	process.exit(0);
});