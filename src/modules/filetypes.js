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

const _ = require('lodash');
/**
 * This are the allowed file types.
 */
exports.values = {

	'backglass': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'application/x-directb2s' ]
	},
	'logo': {
		mimeTypes: [ 'image/png' ]
	},
	'playfield': {
		mimeTypes: [ 'image/jpeg', 'image/png' ]
	},
	'playfield-fs': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'video/mp4', 'video/x-flv', 'video/avi', 'video/x-f4v' ]
	},
	'playfield-ws': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'video/mp4', 'video/x-flv', 'video/avi', 'video/x-f4v' ]
	},
	'release': {
		mimeTypes: [ 'application/x-visual-pinball-table', 'application/x-visual-pinball-table-x', 'text/plain', 'application/vbscript', 'audio/mpeg', 'audio/mp3', 'application/zip', 'application/rar', 'application/x-rar-compressed', 'application/x-zip-compressed' ]
	},
	'rom': {
		mimeTypes: [ 'application/zip', 'application/x-zip-compressed' ]
	}
};

exports.keys = function() {
	return _.keys(exports.values);
};

exports.mimeTypes = function(type) {
	return exports.values[type].mimeTypes;
};

exports.exists = function(type) {
	return exports.values[type] ? true : false;
};
