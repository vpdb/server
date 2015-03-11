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

"use strict";

var _ = require('lodash');
var logger = require('winston');

/**
 * This are the allowed file types.
 */
exports.values = {

	'backglass': {
		mimeTypes: [ 'image/jpeg', 'image/png' ]
	},
	'logo': {
		mimeTypes: [ 'image/png' ]
	},
	'playfield-fs': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'video/mp4', 'video/x-flv', 'video/avi' ]
	},
	'playfield-ws': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'video/mp4', 'video/x-flv', 'video/avi' ]
	},
	'playfield-any': {
		mimeTypes: [ 'image/jpeg', 'image/png', 'video/mp4', 'video/x-flv', 'video/avi' ],
		transform: function(file) {
			var dim;
			if (_.contains(['image/jpeg', 'image/png'], file.mime_type)) {
				dim = file.metadata.size;
			} else {
				if (file.metadata && _.isArray(file.metadata.streams)) {
					for (var i = 0; i < file.metadata.streams.length; i++) {
						if (file.metadata.streams[i].width && file.metadata.streams[i].height) {
							dim = { width: file.metadata.streams[i].width, height: file.metadata.streams[i].height };
							break;
						}
					}
				} else {
					logger.warn('Cannot retrieve dimensions from ' + file.metadata);
					return file.file_type;
				}

			}
			return 'playfield-' + (dim.width > dim.height ? 'ws' : 'fs');
		}
	},
	'release': {
		mimeTypes: [ 'application/x-visual-pinball-table', 'application/x-visual-pinball-table-x', 'text/plain', 'application/vbscript', 'audio/mpeg', 'application/zip' ]
	},
	'rom': {
		mimeTypes: [ 'application/zip' ]
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

exports.doesTransform = function(type) {
	return exports.values[type] && exports.values[type].transform ? true : false;
};

exports.transform = function(type, file) {
	return exports.values[type].transform(file);
};
