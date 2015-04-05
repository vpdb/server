
/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var games = require('../../data/gen/games/games');
var roms = require('../../data/gen/roms/roms');

var local = {
	apiUri: 'http://localhost:3000/api/v1',
	storageUri: 'http://localhost:3000/storage/v1',
	authHeader: 'Authorization',
	credentials: { username: 'test', password: 'xxxxxx' }
};
var test = {
	apiUri: 'https://test.vpdb.io/api/v1',
	storageUri: 'https://test.vpdb.io/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: 'xxxxxx' },
	httpSimple: { username: 'vpdb', password: 'xxxxxx' }
};
var staging = {
	apiUri: 'https://staging.vpdb.ch/api/v1',
	storageUri: 'https://staging.vpdb.ch/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'test', password: 'xxxxxx' }
};
var production = {
	apiUri: 'https://vpdb.ch/api/v1',
	storageUri: 'https://vpdb.ch/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'uploader', password: 'xxxxxx' },
	httpSimple: { username: 'vpdb', password: 'xxxxxx' }
};

var config = test;

config.romFolder = 'E:/Pinball/Visual Pinball-103/VPinMame/roms';

//games.upload(config);
//roms.upload(config);

