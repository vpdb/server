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

import Zip from 'adm-zip'
import { Metadata } from './metadata';
import { File } from '../file';
import { FileVariation } from '../file.variations';

const Unrar = require('unrar');
require('bluebird').promisifyAll(Unrar.prototype);

export class ArchiveMetadata extends Metadata {

	isValid(file: File, variation?: FileVariation): boolean {
		return file.getMimeCategory(variation) === 'archive';
	}

	async getMetadata(file: File, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		const mimeType = variation && variation.mimeType ? variation.mimeType : file.getMimeType();
		const type = mimeType.split('/')[1];
		switch (type) {
			case 'x-rar-compressed':
			case 'rar':
				return await this.getRarMetadata(path);

			case 'zip':
				return this.getZipMetadata(path);
		}
	}

	serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return metadata;
	}

	serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return metadata;
	}

	/**
	 * Reads metadata from rar file
	 * @param {string} path Path to file to read
	 * @return {Promise<{ entries: { filename: string, bytes: number, bytes_compressed: number, crc: string, modified_at: Date }[]}>}
	 */
	private async getRarMetadata(path: string) {

		const archive = new Unrar(path);
		let entries = await archive.listAsync();

		// filter directories
		entries = entries.filter((entry: any) => entry.type === 'File');

		// map data to something useful
		return {
			entries: entries.map((entry: any) => {
				return {
					filename: entry.name,
					bytes: parseInt(entry.size),
					bytes_compressed: parseInt(entry.packedSize),
					crc: parseInt(entry.crc32, 16),
					modified_at: new Date(entry.mtime.replace(/,\d+$/, ''))
				};
			})
		};
	}

	/**
	 * Reads metadata from zip file
	 * @param {string} path Path to file to read
	 * @return {{ entries: { filename: string, bytes: number, bytes_compressed: number, crc: string, modified_at: Date }[]}}
	 */
	private getZipMetadata(path: string) {
		try {

			let entries = new Zip(path).getEntries();

			// filter directories
			entries = entries.filter(entry => !entry.isDirectory);

			// map data to something useful
			return {
				entries: entries.map((entry: any) => {
					return {
						filename: entry.entryName,
						bytes: entry.header.size,
						bytes_compressed: entry.header.compressedSize,
						crc: entry.header.crc,
						modified_at: new Date(entry.header.time)
					};
				})
			};
		} catch (err) {
			throw new Error(err);
		}
	}
}