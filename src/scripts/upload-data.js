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

// override standard promises
Promise = require('bluebird');
const roms = require('../../data/gen/roms/roms');
const credentials = require('./credentials');

// eslint-disable-next-line no-unused-vars
const local = {
	apiUri: 'http://127.0.0.1:3000/api/v1',
	storageUri: 'http://127.0.0.1:3000/storage/v1',
	authHeader: 'Authorization',
	credentials: { username: 'test', password: credentials.user.password }
};
// eslint-disable-next-line no-unused-vars
const test = {
	apiUri: 'https://test.vpdb.io/api/v1',
	storageUri: 'https://test.vpdb.io/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
	httpSimple: { username: credentials.httpSimple.username, password: credentials.httpSimple.password }
};
// eslint-disable-next-line no-unused-vars
const staging = {
	apiUri: 'https://staging.vpdb.io/api/v1',
	storageUri: 'https://staging.vpdb.io/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: credentials.user.password },
	httpSimple: { username: credentials.httpSimple.username, password: credentials.httpSimple.password }
};
const production = {
	apiUri: 'https://api.vpdb.io/v1',
	storageUri: 'https://storage.vpdb.io/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: credentials.user.password }
	//httpSimple: { username: credentials.httpSimple.username, password: credentials.httpSimple.password }
};

const config = production;

config.folder = process.env.VPDB_DATA_FOLDER;
config.romFolder = process.env.VPDB_ROM_FOLDER || process.env.VPDB_DATA_FOLDER || 'F:/Pinball/Visual Pinball-103/VPinMame/roms';

Promise.try(() => {

//	games.upload(config);
	return roms.upload(config);
//	releases.upload(config);

}).then(() => {
	console.log('All done!');

}).catch(err => {
	console.error('ERROR: %s', err.message);
});