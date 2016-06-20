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

"use strict";

/**
 * This are the allowed MIME types.
 */
module.exports = {
	'image/jpeg': {
		name: 'JPEG image',
		ext: 'jpg',
		category: 'image'
	},
	'image/png': {
		name: 'PNG image',
		ext: 'png',
		category: 'image'
	},
	'application/zip': {
		name: 'ZIP-compressed file',
		ext: 'zip',
		category: 'archive'
	},
	'application/rar': {
		name: 'RAR-compressed file',
		ext: 'rar',
		category: 'archive'
	},
	'application/x-directb2s': {
		name: 'Direct B2S Backglass',
		ext: 'directb2s',
		category: 'directb2s'
	},
	'application/x-rar-compressed': {
		name: 'RAR-compressed file',
		ext: 'rar',
		category: 'archive'
	},
	'application/x-shockwave-flash': {
		name: 'Flash Animation',
		ext: 'swf',
		category: 'image'
	},
	'application/x-visual-pinball-table': {
		name: 'Visual Pinball Table v9.x',
		ext: 'vpt',
		category: 'table'
	},
	'application/x-visual-pinball-table-x': {
		name: 'Visual Pinball Table v10.x',
		ext: 'vpx',
		category: 'table'
	},
	'application/vbscript': {
		name: 'Visual Basic Script',
		ext: 'vbs',
		category: 'script'
	},
	'audio/mpeg': {
		name: 'MP3',
		ext: 'mp3',
		category: 'audio'
	},
	'audio/mp3': {
		name: 'MP3',
		ext: 'mp3',
		category: 'audio'
	},
	'video/avi': {
		name: 'AVI video',
		ext: 'avi',
		category: 'video'
	},
	'video/mp4': {
		name: 'MP4 video',
		ext: 'mp4',
		category: 'video'
	},
	'video/x-flv': {
		name: 'Flash video',
		ext: 'flv',
		category: 'video'
	},
	'video/x-f4v': {
		name: 'Flash video as MP4',
		ext: 'f4v',
		category: 'video'
	},
	'text/plain': {
		name: 'Plain text',
		ext: 'txt',
		category: 'text'
	}
};