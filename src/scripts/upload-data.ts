'use strict';
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

import { uploadGames } from '../../data/gen/games/games';

const roms = require('../../data/gen/roms/roms');
const credentials = require('./credentials');

const local: UploadConfig = {
	apiUri: 'http://127.0.0.1:3000/api',
	storageUri: 'http://127.0.0.1:3000/storage',
	authHeader: 'Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
};
const test: UploadConfig = {
	apiUri: 'https://test.vpdb.io/api',
	storageUri: 'https://test.vpdb.io/storage',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
	httpSimple: { username: credentials.httpSimple.username, password: credentials.httpSimple.password },
};
const staging: UploadConfig = {
	apiUri: 'https://staging.vpdb.io/api',
	storageUri: 'https://staging.vpdb.io/storage',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
	httpSimple: { username: credentials.httpSimple.username, password: credentials.httpSimple.password },
};
const production: UploadConfig = {
	apiUri: 'https://api.vpdb.io',
	storageUri: 'https://storage.vpdb.io',
	authHeader: 'Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
};

const config = local;

config.folder = process.env.VPDB_DATA_FOLDER;
config.romFolder = process.env.VPDB_ROM_FOLDER || process.env.VPDB_DATA_FOLDER || 'F:/Pinball/Visual Pinball-103/VPinMame/roms';

(async () => {
	try {
		await uploadGames(config);
//		return roms.upload(config);
//		releases.upload(config);
		console.log('All done!');
	} catch (err) {
		console.error(err);
	}
})();

export interface UploadConfig {
	apiUri: string;
	storageUri: string;
	authHeader: string;
	credentials: { username: string, password: string; };
	httpSimple?: { username: string, password: string; };
	folder?: string;
	romFolder?: string;
}
