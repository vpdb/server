/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { isUndefined, keys, times } from 'lodash';

import { createHash } from 'crypto';
import { FileUtil } from '../files/file.util';
import { TableBlock } from '../releases/release.tableblock';
import { logger } from './logger';
import { OleCompoundDoc, Storage } from './ole-doc';
import { RequestState } from './typings/context';

const bindexOf = require('buffer-indexof');

class VisualPinballTable {

	/**
	 * Extracts the table script from a given .vpt file.
	 *
	 * @param requestState For logging
	 * @param {string} tablePath Path to the .vpt file. File must exist.
	 * @return {Promise} Table script
	 */
	public async readScriptFromTable(requestState: RequestState, tablePath: string): Promise<{ code: string, head: Buffer, tail: Buffer }> {
		const now = Date.now();
		/* istanbul ignore if */
		if (!(await FileUtil.exists(tablePath))) {
			throw new Error('File "' + tablePath + '" does not exist.');
		}
		const doc = await this.readDoc(tablePath);

		const storage = doc.storage('GameStg');
		const buf = await this.readStream(storage, 'GameData');

		const codeStart: number = bindexOf(buf, Buffer.from('04000000434F4445', 'hex')); // 0x04000000 "CODE"
		const codeEnd: number = bindexOf(buf, Buffer.from('04000000454E4442', 'hex'));   // 0x04000000 "ENDB"
		logger.info(requestState, '[VisualPinballTable.readScriptFromTable] Found GameData for "%s" in %d ms.', tablePath, Date.now() - now);
		/* istanbul ignore if */
		if (codeStart < 0 || codeEnd < 0) {
			throw new Error('Cannot find CODE part in BIFF structure.');
		}
		return {
			code: buf.slice(codeStart + 12, codeEnd).toString(),
			head: buf.slice(0, codeStart + 12),
			tail: buf.slice(codeEnd),
		};
	}

	/**
	 * Returns all TableInfo fields of the table file.
	 *
	 * @param requestState For logging
	 * @param {string} tablePath Path to the .vpt file. File must exist.
	 * @return {Promise<object>} Table properties
	 */
	public async getTableInfo(requestState: RequestState, tablePath: string): Promise<{ [key: string]: string }> {

		/* istanbul ignore if */
		if (!(await FileUtil.exists(tablePath))) {
			throw new Error('File "' + tablePath + '" does not exist.');
		}
		const doc = await this.readDoc(tablePath);

		const storage = doc.storage('TableInfo');
		const props: { [key: string]: string } = {};
		if (!storage) {
			logger.warn(requestState, '[VisualPinballTable.getTableInfo] Storage "TableInfo" not found in "%s".', tablePath);
			return props;
		}
		const streams: { [key: string]: string } = {
			TableName: 'table_name',
			AuthorName: 'author_name',
			TableBlurp: 'table_blurp',
			TableRules: 'table_rules',
			AuthorEmail: 'author_email',
			ReleaseDate: 'release_date',
			TableVersion: 'table_version',
			AuthorWebSite: 'author_website',
			TableDescription: 'table_description',
		};
		for (const key of keys(streams)) {
			const propKey = streams[key];
			try {
				const buf = await this.readStream(storage, key);
				if (buf) {
					props[propKey] = buf.toString().replace(/\0/g, '');
				}
			} catch (err) {
				logger.warn(requestState, '[VisualPinballTable.getTableInfo] %s', err.message);
			}
		}
		return props;
	}

	/**
	 * Returns an array of elements of which the table file is made of.
	 *
	 * Each element contains a hash, which can be used to quickly lookup equal
	 * elements in the database. There are additional attributes like size
	 * and metadata.
	 *
	 * @param requestState For logging
	 * @param {string} tablePath Path to table file
	 * @return {Promise<TableBlock[]>}
	 */
	public async analyzeFile(requestState: RequestState, tablePath: string): Promise<TableBlock[]> {
		const started = Date.now();
		logger.info(requestState, '[VisualPinballTable.analyzeFile] Analyzing %s..', tablePath);
		const doc = await this.readDoc(tablePath);
		const storage = doc.storage('GameStg');
		const gameDataStream = await this.readStream(storage, 'GameData');
		const block = this.parseBiff(gameDataStream);
		const gameData = this.parseGameData(block);
		const tableBlocks: TableBlock[] = [];

		// images
		for (const streamName of times(gameData.numTextures, n => 'Image' + n)) {
			const data = await this.readStream(storage, streamName);
			const blocks = this.parseBiff(data);
			const [parsedData, meta] = this.parseImage(blocks, streamName);
			const tableBlock = this.analyzeBlock(requestState, parsedData || data, 'image', meta);
			if (tableBlock) {
				tableBlocks.push(tableBlock);
			}
		}
		// sounds
		for (const streamName of times(gameData.numSounds, n => 'Sound' + n)) {
			const data = await this.readStream(storage, streamName);
			const blocks = this.parseUntaggedBiff(data);
			const [parsedData, meta] = await this.parseSound(blocks, streamName);
			const tableBlock = this.analyzeBlock(requestState, parsedData || data, 'sound', meta);
			if (tableBlock) {
				tableBlocks.push(tableBlock);
			}
		}

		// game items
		for (const streamName of times(gameData.numGameItems, n => 'GameItem' + n)) {
			const data = await this.readStream(storage, streamName);
			const blocks = await this.parseBiff(data, 4);
			const meta = await this.parseGameItem(blocks, streamName);
			const tableBlock = this.analyzeBlock(requestState, data, 'gameitem', meta);
			if (tableBlock) {
				tableBlocks.push(tableBlock);
			}
		}

		// collections
		for (const streamName of times(gameData.numCollections, n => 'Collection' + n)) {
			const data = await this.readStream(storage, streamName);
			const blocks = await this.parseBiff(data);
			const meta = await this.parseCollection(blocks, streamName);
			const tableBlock = this.analyzeBlock(requestState, data, 'collection', meta);
			if (tableBlock) {
				tableBlocks.push(tableBlock);
			}
		}

		logger.info(requestState, '[VisualPinballTable.analyzeFile] Found %d items in table file in %sms:', tableBlocks.length, new Date().getTime() - started);
		logger.info(requestState, '        - %d textures.', gameData.numTextures);
		logger.info(requestState, '        - %d sounds.', gameData.numSounds);
		logger.info(requestState, '        - %d game items.', gameData.numGameItems);
		logger.info(requestState, '        - %d collections.', gameData.numCollections);
		return tableBlocks;
	}

	/**
	 * Starts reading the compound documents.
	 *
	 * @param {string} filename Path to file to read
	 * @returns {Promise<OleCompoundDoc>}
	 */
	private async readDoc(filename: string): Promise<OleCompoundDoc> {
		const doc = new OleCompoundDoc(filename);
		await doc.read();
		return doc;
	}

	/**
	 * Reads a given stream from a given storage.
	 *
	 * @param {Storage} storage Storage to read data from
	 * @param {string} key Key within the storage
	 * @return {Promise<Buffer>} Read data
	 */
	private async readStream(storage: Storage, key: string): Promise<Buffer> {
		if (!storage) {
			throw new Error('No such storage.');
		}
		return new Promise<Buffer>((resolve, reject) => {
			const strm = storage.stream(key);
			const bufs: Buffer[] = [];
			if (!strm) {
				return reject(new Error('No such stream "' + key + '".'));
			}
			strm.on('error', reject);
			strm.on('data', (buf: Buffer) => bufs.push(buf));
			strm.on('end', () => {
				resolve(Buffer.concat(bufs));
			});
		});
	}

	/**
	 * Tries to parse the BIFF format and returns all blocks as an array.
	 *
	 * @param {Buffer} buf Buffer to parse
	 * @param {number} [offset=0] Where to start to read
	 * @returns {Block} All BIFF blocks.
	 */
	private parseBiff(buf: Buffer, offset: number = 0): Block[] {
		offset = offset || 0;
		let tag: string;
		let data: Buffer;
		let blockSize: number;
		let block: Buffer;
		const blocks: Block[] = [];
		let i = offset;
		try {
			do {
				/* usually, we have:
				 *    4 bytes size of block (blockSize)
				 *    blockSize bytes of data, where data is
				 *        4 bytes tag name
				 *        (blockSize - 4) bytes data
				 */
				blockSize = buf.slice(i, i + 4).readInt32LE(0);  // size of the block excluding the 4 size bytes
				block = buf.slice(i + 4, i + 4 + blockSize);     // contains tag and data
				tag = block.slice(0, 4).toString();
				let counterIncreased = false;

				//noinspection FallthroughInSwitchStatementJS
				switch (tag) {

					// ignored
					case 'FONT':
						/* not hashed, but need to find out how many bytes to skip. best guess: tag
						 * is followed by 8 bytes of whatever, then 2 bytes size BE, followed by
						 * data.
						 */
						blockSize = buf.readInt16BE(i + 17);
						i += 19 + blockSize;
						counterIncreased = true;
						break;

					// streams
					case 'CODE':

						/* in here, the data starts with 4 size bytes again. this is a special case,
						 * what's hashed now is only the tag and the data *after* the 4 size bytes.
						 * concretely, we have:
						 *    4 bytes size of block (blockSize above)
						 *    4 bytes tag name (tag)
						 *    4 bytes size of code (blockSize below)
						 *    n bytes of code (block below)
						 */
						i += 8;
						blockSize = buf.slice(i, i + 4).readInt32LE(0);
						block = buf.slice(i + 4, i + 4 + blockSize);
						block = Buffer.concat([Buffer.from(tag), block]);
						break;
				}

				if (!counterIncreased) {
					if (blockSize > 4) {
						data = block.slice(4);
						blocks.push({ tag, data });
					}
					i += blockSize + 4;
				}

				//console.log('*** Adding block [%d] %s: %s', blockSize, tag, data && data.length > 100 ? data.slice(0, 100) : data);
				//console.log('*** Adding block [%d] %s', blockSize, block.length > 100 ? block.slice(0, 100) : block);

			} while (i < buf.length - 4);

		} catch (err) {
			// do nothing and return what we have..
		}
		return blocks;
	}

	/**
	 * Parses BIFF data that doesn't contain tags.
	 *
	 * @param {Buffer} buf Buffer to parse
	 * @param {number} [offset=0] Where to start read
	 * @return {Buffer[]} All BIFF blocks.
	 */
	private parseUntaggedBiff(buf: Buffer, offset: number = 0): Buffer[] {
		offset = offset || 0;
		let blockSize: number;
		let block: Buffer;
		const blocks: Buffer[] = [];
		let i = offset;
		do {
			/* we have:
			 *    4 bytes size of block (blockSize)
			 *    blockSize bytes of data
			 */
			blockSize = buf.slice(i, i + 4).readInt32LE(0);  // size of the block excluding the 4 size bytes
			block = buf.slice(i + 4, i + 4 + blockSize);     // contains data
			blocks.push(block);
			i += blockSize + 4;

		} while (i < buf.length - 4 && blockSize > 0);
		return blocks;
	}

	/**
	 * Parses the stream counters and table script from the "GameData" stream.
	 *
	 * @param {Block[]} blocks "GameData" blocks
	 * @return {GameDataItem} GameData values
	 */
	private parseGameData(blocks: Block[]): GameDataItem {
		const gameData: GameDataItem = {};
		blocks.forEach(block => {
			switch (block.tag) {
				case 'SEDT':
					if (isUndefined(gameData.numGameItems)) {
						gameData.numGameItems = block.data.readInt32LE(0);
					}
					break;
				case 'SSND':
					if (isUndefined(gameData.numSounds)) {
						gameData.numSounds = block.data.readInt32LE(0);
					}
					break;
				case 'SIMG':
					if (isUndefined(gameData.numTextures)) {
						gameData.numTextures = block.data.readInt32LE(0);
					}
					break;
				case 'SFNT':
					if (isUndefined(gameData.numFonts)) {
						gameData.numFonts = block.data.readInt32LE(0);
					}
					break;
				case 'SCOL':
					if (isUndefined(gameData.numCollections)) {
						gameData.numCollections = block.data.readInt32LE(0);
					}
					break;
				case 'CODE':
					if (isUndefined(gameData.script)) {
						gameData.script = block.data.toString('utf8');
					}
					break;
			}
		});
		return gameData;
	}

	/**
	 * Parses data from an image stream.
	 *
	 * @param {Block[]} blocks "Image" blocks
	 * @param {string} streamName Name of the stream, e.g. "Image0"
	 * @return {[Buffer, ImageItem]}
	 */
	private parseImage(blocks: Block[], streamName: string): [Buffer, ImageItem] {
		const meta: ImageItem = { stream: streamName };
		let data = null;
		blocks.forEach(block => {
			switch (block.tag) {
				case 'NAME': meta.name = this.parseString(block.data); break;
				case 'PATH': meta.path = this.parseString(block.data).replace(/\\+/g, '\\'); break;
				case 'WDTH': meta.width = block.data.readInt32LE(0); break;
				case 'HGHT': meta.height = block.data.readInt32LE(0); break;
				case 'DATA': data = block.data; break;
			}
		});
		return [data, meta];
	}

	/**
	 * Parses data from a sound stream.
	 *
	 * @param {Buffer[]} blocks "Sound" blocks
	 * @param {string} streamName Name of the stream, e.g. "Sound0"
	 * @return {[Buffer, SoundItem]}
	 */
	private parseSound(blocks: Buffer[], streamName: string): [Buffer, SoundItem] {
		return [blocks[3], {
			stream: streamName,
			name: blocks[0].toString('utf8'),
			path: blocks[1] ? blocks[1].toString('utf8').replace(/\\/g, '/') : null,
			id: blocks[2] ? blocks[2].toString('utf8') : null,
		}];
	}

	/**
	 * Parses data from a game item stream.
	 *
	 * @param {Block[]} blocks "GameItem" blocks
	 * @param {string} streamName Name of the stream, e.g. "GameItem0"
	 * @return {BaseItem}
	 */
	private parseGameItem(blocks: Block[], streamName: string): BaseItem {
		const meta: BaseItem = { stream: streamName };
		blocks.forEach(block => {
			switch (block.tag) {
				case 'NAME':
					meta.name = this.parseString16(block.data);
					break;
			}
		});
		return meta;
	}

	/**
	 * Parses data from a collection stream.
	 *
	 * @param {Block[]} blocks "Collection" blocks
	 * @param {string} streamName Name of the stream, e.g. "Collection0"
	 * @return {BaseItem}
	 */
	private parseCollection(blocks: Block[], streamName: string): BaseItem {
		const meta: BaseItem = { stream: streamName };
		blocks.forEach(block => {
			switch (block.tag) {
				case 'NAME':
					meta.name = this.parseString16(block.data);
					break;
			}
		});
		return meta;
	}

	/**
	 * Parses a UTF-8 string from a block.
	 *
	 * @param {Buffer} block Block to parse
	 * @returns {string} Parsed string
	 */
	private parseString(block: Buffer) {
		return block.slice(4).toString('utf8');
	}

	/**
	 * Parses a UTF-16 string from a block.
	 *
	 * @param {Buffer} block Block to parse
	 * @return {string} Parsed string
	 */
	private parseString16(block: Buffer) {
		const chars: number[] = [];
		block.slice(4).forEach((v, i) => {
			if (i % 2 === 0) {
				chars.push(v);
			}
		});
		return Buffer.from(chars).toString('utf8');
	}

	/**
	 * Returns block data for saving to the database.
	 *
	 * @param requestState For logging
	 * @param {Buffer} data Data to hash
	 * @param {string} type Item type (image, sound, gameitem, collection)
	 * @param meta Parsed metadata
	 * @return {TableBlock}
	 */
	private analyzeBlock(requestState: RequestState, data: Buffer, type: string, meta: any): TableBlock {
		if (!data) {
			logger.error(requestState, '[VisualPinballTable.analyzeBlock] Ignoring empty data for %s.', meta.stream);
			return null;
		}
		return {
			hash: createHash('md5').update(data).digest(),
			bytes: data.length,
			type,
			meta,
		} as TableBlock;
	}
}

interface Block {
	tag: string;
	data: Buffer;
}

interface BaseItem {
	stream: string;
	name?: string;
}

interface SoundItem extends BaseItem {
	path: string;
	id: string;
}

interface ImageItem extends BaseItem {
	path?: string;
	width?: number;
	height?: number;
}

interface GameDataItem {
	numGameItems?: number;
	numSounds?: number;
	numTextures?: number;
	numFonts?: number;
	numCollections?: number;
	collections?: number;
	script?: string;
}

export const visualPinballTable = new VisualPinballTable();
