/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { uniq, flatten } from 'lodash';
import { BackglassVariation, VideoFileVariation } from './file.variations';
import { FileVariation, ImageFileVariation } from './file.variations';

class FileTypes {

	private readonly backglassImage:FileType<ImageFileVariation> = {
		name: 'backglass',
		mimeTypes: ['image/jpeg', 'image/png'],
		variations: [
			{ name: 'full',                               mimeType: 'image/jpeg', quality: 60 },
			{ name: 'medium',    width: 364, height: 291, mimeType: 'image/jpeg' },
			{ name: 'medium-2x', width: 728, height: 582, mimeType: 'image/jpeg' },
			{ name: 'small',     width: 253, height: 202, mimeType: 'image/jpeg' },
			{ name: 'small-2x',  width: 506, height: 404, mimeType: 'image/jpeg' },
		]
	};

	private readonly backglassDirectB2s:FileType<BackglassVariation> = {
		name: 'backglass',
		mimeTypes: ['application/x-directb2s'],
		variations: [
			{ name: 'full',                               mimeType: 'image/jpeg', cutGrill: false },
			{ name: 'medium',    width: 364, height: 291, mimeType: 'image/jpeg', cutGrill: true, quality: 85, modulate: 200, source: 'medium-2x' },
			{ name: 'medium-2x', width: 728, height: 582, mimeType: 'image/jpeg', cutGrill: true, quality: 80, modulate: 200 },
			{ name: 'small',     width: 253, height: 202, mimeType: 'image/jpeg', cutGrill: true, quality: 90, modulate: 200, source: 'small-2x' },
			{ name: 'small-2x',  width: 506, height: 404, mimeType: 'image/jpeg', cutGrill: true, quality: 80, modulate: 200, source: 'medium-2x' }
		]
	};

	private readonly logo:FileType<ImageFileVariation> = {
		name: 'logo',
		mimeTypes: ['image/png'],
		variations: [
			{ name: 'medium',    width: 300, height: 600, mimeType: 'image/png' },
			{ name: 'medium-2x', width: 600, height: 1200, mimeType: 'image/png' }
		]
	};

	private readonly playfield:FileType<ImageFileVariation> = {
		name: 'playfield',
		mimeTypes: ['image/jpeg', 'image/png'],
		variations: [
			{ name: 'landscape',    landscape: true,  width: 393, height: 393, mimeType: 'image/jpeg' },
			{ name: 'landscape-2x', landscape: true,  width: 786, height: 786, mimeType: 'image/jpeg' }
		]
	};

	private readonly playfieldImagePortrait:FileType<ImageFileVariation> = {
		name: 'playfield-fs',
		mimeTypes: ['image/jpeg', 'image/png'],
		variations: [
			{ name: 'full',                                         mimeType: 'image/jpeg', quality: 60 },
			{ name: 'medium',              width: 280, height: 498, mimeType: 'image/jpeg' },
			{ name: 'medium-2x',           width: 560, height: 996, mimeType: 'image/jpeg' },
			{ name: 'square',    portraitToSquare: true, size: 120, mimeType: 'image/jpeg' },
			{ name: 'square-2x', portraitToSquare: true, size: 240, mimeType: 'image/jpeg' },
			{ name: 'landscape',    rotate: 90, width: 393, height: 393, mimeType: 'image/jpeg' },
			{ name: 'landscape-2x', rotate: 90, width: 786, height: 786, mimeType: 'image/jpeg' },
			{ name: 'hyperpin', rotate: 90,                         mimeType: 'image/png' }
		]
	};

	private readonly playfieldVideoPortrait:FileType<VideoFileVariation> = {
		name: 'playfield-fs',
		mimeTypes: ['video/mp4', 'video/x-flv', 'video/avi', 'video/x-f4v'],
		variations: [
			{ name: 'still',         mimeType: 'image/png', screenshot: true, position: '0:0.500' },
			{ name: 'small-rotated', mimeType: 'video/mp4', width: 394, height: 234, rotate: true }
		]
	};

	private readonly playfieldImageLandscape:FileType<ImageFileVariation> = {
		name: 'playfield-ws',
		mimeTypes: ['image/jpeg', 'image/png'],
		variations: [
			{ name: 'full',                               mimeType: 'image/jpeg', quality: 60 },
			{ name: 'medium',    width: 280, height: 158, mimeType: 'image/jpeg' },
			{ name: 'medium-2x', width: 560, height: 315, mimeType: 'image/jpeg' },
			{ name: 'square',    wideToSquare: true, size: 120, mimeType: 'image/jpeg' },
			{ name: 'square-2x', wideToSquare: true, size: 240, mimeType: 'image/jpeg' },
			{ name: 'landscape',    width: 393, height: 393, mimeType: 'image/jpeg' },
			{ name: 'landscape-2x', width: 786, height: 786, mimeType: 'image/jpeg' },
			{ name: 'hyperpin',                                 mimeType: 'image/png' }
		]
	};

	private readonly playfieldVideoLandscape: FileType<VideoFileVariation> = {
		name: 'playfield-ws',
		mimeTypes: ['video/mp4', 'video/x-flv', 'video/avi', 'video/x-f4v'],
		variations: [
			{ name: 'still',         mimeType: 'image/png', screenshot: true, position: '0:0.500' },
			{ name: 'small-rotated', mimeType: 'video/mp4', width: 394, height: 234 }
		]
	};

	private readonly landscape: FileType<ImageFileVariation> = {
		name: 'landscape',
		mimeTypes: ['image/jpeg', 'image/png'],
		variations: []
	};

	private readonly releaseTable: FileType<FileVariation> = {
		name: 'release',
		mimeTypes: ['application/x-visual-pinball-table', 'application/x-visual-pinball-table-x'],
		variations: []
	};

	private readonly release: FileType<FileVariation> = {
		name: 'release',
		mimeTypes: ['text/plain', 'application/vbscript', 'audio/mpeg', 'audio/mp3', 'application/zip', 'application/rar', 'application/x-rar-compressed', 'application/x-zip-compressed'],
		variations: []
	};

	private readonly rom: FileType<FileVariation> = {
		name: 'rom',
		mimeTypes: ['application/zip', 'application/x-zip-compressed'],
		variations: []
	};

	public names: string[];
	private fileTypes: FileType<FileVariation>[];

	constructor() {
		this.fileTypes = [this.backglassImage, this.backglassDirectB2s, this.logo, this.playfield,
			this.playfieldImageLandscape, this.playfieldImagePortrait, this.playfieldVideoLandscape,
			this.playfieldVideoPortrait, this.landscape, this.releaseTable, this.release, this.rom];

		this.names = uniq(this.fileTypes.map(t => t.name));
	}

	/**
	 * Returns all MIME types for a given file type
	 * @param {string} name File type
	 * @return {string[]} Available MIME types
	 */
	getMimeTypes(name: string): string[] {
		return flatten(this.fileTypes.filter(t => t.name === name).map(t => t.mimeTypes));
	}

	/**
	 * Returns all variations for a given file type and MIME type.
	 * @param {string} name File type
	 * @param {string} mimeType MIME type
	 * @return {V[]} Variations
	 */
	getVariations<V extends FileVariation>(name: string, mimeType: string): V[] {
		return this.fileTypes.find(t => t.name === name && t.mimeTypes.includes(mimeType)).variations as V[];
	}

	/**
	 * Returns the variation for a given file type, MIME type and variation name.
	 * @param {string} name File type
	 * @param {string} mimeType MIME type
	 * @param {string} variationName Variation name
	 * @return {V} File variation
	 */
	getVariation<V extends FileVariation>(name: string, mimeType: string, variationName: string): V {
		if (!variationName) {
			return null;
		}
		return this.getVariations<V>(name, mimeType).find(v => v.name === variationName);
	}

	/**
	 * Returns variation names of a number of file types.
	 * For example, getting all playfield variations would be:
	 *
	 * @example getVariationNames(['playfield','playfield-fs','playfield-ws'])
	 * @param {string[]} fileTypes
	 * @return {string[]}
	 */
	getVariationNames(fileTypes: string[]): string[] {
		return uniq(flatten(this.fileTypes.filter(t => fileTypes.includes(t.name)).map(t => t.variations.map(v => v.name))));
	}

	/**
	 * Checks whether a given file type exists.
	 *
	 * @param {string} name Name of the file type
	 * @return {boolean} True if exists, false otherwise.
	 */
	exists(name: string) {
		return this.names.includes(name);
	}
}

export interface FileType<V extends FileVariation> {
	name: string;
	mimeTypes: string[];
	variations: V[];
}

export const fileTypes = new FileTypes();