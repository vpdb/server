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

exports.values = {
	orientation: {
		fs: {
			name: 'Portrait',
			hint: 'Cabinet',
			description: 'Rotated portrait, usually 270°. Also known as "FS" (fullscreen).',
			filenameTag: 'FS'
		},
		ws: {
			name: 'Desktop',
			hint: 'Landscape',
			description: 'Typical landscape monitor orientation, also known as "DT" (desktop).',
			filenameTag: 'DT'
		},
		any: {
			name: 'Universal',
			hint: 'Any orientation',
			description: 'Tables built with VP10+ that are fully 3D and can be rendered at any orientation.',
			filenameTag: ''
		}
	},
	lighting: {
		day: {
			name: 'Day',
			hint: 'Illuminated Playfield',
			description: 'Ambient light is high, resulting in a low contrast between playfield and lamps.',
			filenameTag: ''
		},
		night: {
			name: 'Night',
			hint: 'Dark Playfield',
			description: 'Ambient light is low, resulting in a high contrast between playfield and lamps.',
			filenameTag: 'Nightmod'
		},
		any: {
			name: 'Universal',
			hint: 'Customizable',
			description: 'Tables built with VP10+ where lighting can be adjusted with the slider.',
			filenameTag: ''
		}
	}
};

exports.keys = function(type) {
	return type ? _.keys(exports.values[type]) : _.keys(exports.values);
};

exports.defaultFileTags = function() {
	return _.mapValues(exports.values, function(flavorType) {
		// flavorType = { fs: { name: 'Portrait', ..., filenameTag: 'FS' }}
		return _.mapValues(flavorType, function(flavorItem) {
			// flavorItem = { name: 'Portrait', ..., filenameTag: 'FS' }
			return flavorItem.filenameTag;
		});
	});
};

exports.defaultThumb = function(opts) {
	var defaultThumb = {};
	defaultThumb.lighting = opts.lighting || 'day';
	defaultThumb.orientation = opts.orientation || 'fs';
	return defaultThumb;
};