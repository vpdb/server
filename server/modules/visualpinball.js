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
const fs = require('fs');
const ocd = require('ole-doc').OleCompoundDoc;
const async = require('async');
const crypto = require('crypto');
const events = require('events');
const logger = require('winston');
const bindexOf = require('buffer-indexof');

/**
 * Extracts the table script from a given .vpt file.
 *
 * @param tablePath Path to the .vpt file. File must exist.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Table script</li></ol>
 */
exports.readScriptFromTable = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback(new Error('File "' + tablePath + '" does not exist.'));
	}
	var now = new Date().getTime();
	var doc = new ocd(tablePath);
	doc.on('err', /* istanbul ignore next */ function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var storage = doc.storage('GameStg');
		/* istanbul ignore else */
		if (storage) {
			try {
				var strm = storage.stream('GameData');
				var bufs = [];
				strm.on('data', function(buf) {
					bufs.push(buf);
				});
				strm.on('end', function() {
					var buf = Buffer.concat(bufs);

					var codeStart = bindexOf(buf, new Buffer('04000000434F4445', 'hex')); // 0x04000000 "CODE"
					var codeEnd = bindexOf(buf, new Buffer('04000000454E4442', 'hex'));   // 0x04000000 "ENDB"
					logger.info('[vp] [script] Found GameData for "%s" in %d ms.', tablePath, new Date().getTime() - now);
					/* istanbul ignore if */
					if (codeStart < 0 || codeEnd < 0) {
						return callback(new Error('Cannot find CODE part in BIFF structure.'));
					}
					callback(null, {
						code: buf.slice(codeStart + 12, codeEnd).toString(),
						head: buf.slice(0, codeStart + 12),
						tail: buf.slice(codeEnd)
					});
				});
			} catch(err) {
				/* istanbul ignore next */
				callback(new Error('Cannot find stream "GameData" in storage "GameStg".'));
			}
		} else {
			callback(new Error('Cannot find storage "GameStg".'));
		}
	});
	doc.read();
};


exports.getTableInfo = function(tablePath, callback) {

	/* istanbul ignore if */
	if (!fs.existsSync(tablePath)) {
		return callback(new Error('File "' + tablePath + '" does not exist.'));
	}
	var doc = new ocd(tablePath);
	doc.on('err', /* istanbul ignore next */ function(err) {
		logger.warn('[vp] [table info] Error reading file "%s": %s', tablePath, err.message);
		callback(null, {});
	});
	doc.on('ready', function() {
		var storage = doc.storage('TableInfo');

		/* istanbul ignore else */
		if (storage) {
			var streams = {
				TableName: 'table_name',
				AuthorName: 'author_name',
				TableBlurp: 'table_blurp',
				TableRules: 'table_rules',
				AuthorEmail: 'author_email',
				ReleaseDate: 'release_date',
				TableVersion: 'table_version',
				AuthorWebSite: 'author_website',
				TableDescription: 'table_description'
			};
			var props = {};
			async.eachSeries(_.keys(streams), function(stream, next) {
				try {
					var strm = storage.stream(stream);
					var bufs = [];
					strm.on('data', function(buf) {
						bufs.push(buf);
					});
					strm.on('end', function() {
						var buf = Buffer.concat(bufs);
						props[streams[stream]] = buf.toString().replace(/\0/g, '');
						next();
					});
					strm.on('err', /* istanbul ignore next */ function(err) {
						logger.warn('[vp] [table info] Error reading stream "%s": %s', stream, err.message);
						next();
					});
				} catch (err) {
					logger.warn('[vp] [table info] Error reading stream "%s" from table: %s', stream, err.message);
					next();
				}
			}, function() {
				callback(null, props);
			});

		} else {
			logger.warn('[vp] [table info] Storage "TableInfo" not found in "%s".', tablePath);
			callback(null, {});
		}
	});
	doc.read();
};


/**
 * Returns an array of elements of which the table file is made of.
 *
 * Each element contains a hash, which can be used to quickly lookup equal
 * elements in the database. There are additional attributes like size
 * and metadata.
 *
 * @param {string} tablePath Path to table file
 * @return {Promise.<{ hash: Buffer, bytes: number, type: string, meta: object }>[]}
 */
exports.analyzeFile = function(tablePath) {
	return Promise.try(() => {
		let storage;
		let tableBlocks = [];
		let gameData;
		const started = new Date().getTime();
		logger.info('[vp] Analyzing %s..', tablePath);
		return readDoc(tablePath).then(doc => {
			storage = doc.storage('GameStg');
			return readStream(storage, 'GameData');

		}).then(parseBiff).then(parseGameData).then(data => {
			gameData = data;

			// images
			return Promise.mapSeries(_.times(gameData.numTextures, n => 'Image' + n), streamName => {
				return readStream(storage, streamName).then(data => {
					let blocks = parseBiff(data);
					let [parsedData, meta] = parseImage(blocks, streamName);
					return analyzeBlock(parsedData || data, 'image', meta);
				});
			});

		}).then(blocks => {
			tableBlocks = tableBlocks.concat(blocks);

			// sounds
			return Promise.mapSeries(_.times(gameData.numSounds, n => 'Sound' + n), streamName => {
				return readStream(storage, streamName).then(data => {
					let blocks = parseUntaggedBiff(data);
					let [parsedData, meta] =  parseSound(blocks, streamName);
					return analyzeBlock(parsedData || data, 'sound', meta);
				});
			});

		}).then(blocks => {
			tableBlocks = tableBlocks.concat(blocks);

			// game items
			return Promise.mapSeries(_.times(gameData.numGameItems, n => 'GameItem' + n), streamName => {
				return readStream(storage, streamName).then(data => {
					let blocks = parseBiff(data, 4);
					let meta = parseGameItem(blocks, streamName);
					return analyzeBlock(data, 'gameitem', meta)
				});
			});

		}).then(blocks => {
			tableBlocks = tableBlocks.concat(blocks);

			// collections
			return Promise.mapSeries(_.times(gameData.numCollections, n => 'Collection' + n), streamName => {
				return readStream(storage, streamName).then(data => {
					let blocks = parseBiff(data);
					let meta = parseCollection(blocks, streamName);
					return analyzeBlock(data, 'collection', meta)
				});
			});

		}).then(blocks => {
			tableBlocks = tableBlocks.concat(blocks);
			logger.info('[vp] Found %d items in table file in %sms:', tableBlocks.length, new Date().getTime() - started);
			logger.info('        - %d textures.', gameData.numTextures);
			logger.info('        - %d sounds.', gameData.numSounds);
			logger.info('        - %d game items.', gameData.numGameItems);
			logger.info('        - %d collections.', gameData.numCollections);
			return tableBlocks;
		});
	});
};

/**
 * Starts readinf the compound documents.
 * @param {string} filename Path to file to read
 * @returns {Promise.<OleCompoundDoc>}
 */
function readDoc(filename) {
	return new Promise((resolve, reject) => {
		const doc = new ocd(filename);
		doc.on('err', reject);
		doc.on('ready', () => {
			resolve(doc);
		});
		doc.read();
	});
}

/**
 * Reads a given stream from a given storage.
 *
 * @param {Storage} storage Storage to read data from
 * @param {string} key Key within the storage
 * @returns {Promise.<Buffer>} Read data
 */
function readStream(storage, key) {
	return new Promise((resolve, reject) => {
		const strm = storage.stream(key);
		const bufs = [];
		strm.on('error', reject);
		strm.on('data', buf => bufs.push(buf));
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
 * @returns {[{ tag: string, data: Buffer }]} All BIFF blocks.
 */
function parseBiff(buf, offset) {
	offset = offset || 0;
	let tag, data, blockSize, block;
	let blocks = [];
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
					block = Buffer.concat([new Buffer(tag), block]);

				default:
					if (blockSize > 4) {
						data = block.slice(4);
						blocks.push({ tag: tag, data: data });
					}
					i += blockSize + 4;
					break;
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
 * @returns {Buffer[]} All BIFF blocks.
 */
function parseUntaggedBiff(buf, offset) {
	offset = offset || 0;
	let blockSize, block, blocks = [];
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
 * @param {{ tag: string, data: Buffer }[]} blocks "GameData" blocks
 * @returns {{ numGameItems: number, numSounds: number, numTextures: number, numFonts: number, collections: number, script: string }} GameData values
 */
function parseGameData(blocks) {
	let gameData = {};
	blocks.forEach(block => {
		switch (block.tag) {
			case 'SEDT':
				if (_.isUndefined(gameData.numGameItems)) {
					gameData.numGameItems = block.data.readInt32LE(0);
				}
				break;
			case 'SSND':
				if (_.isUndefined(gameData.numSounds)) {
					gameData.numSounds = block.data.readInt32LE(0);
				}
				break;
			case 'SIMG':
				if (_.isUndefined(gameData.numTextures)) {
					gameData.numTextures = block.data.readInt32LE(0);
				}
				break;
			case 'SFNT':
				if (_.isUndefined(gameData.numFonts)) {
					gameData.numFonts = block.data.readInt32LE(0);
				}
				break;
			case 'SCOL':
				if (_.isUndefined(gameData.numCollections)) {
					gameData.numCollections = block.data.readInt32LE(0);
				}
				break;
			case 'CODE':
				if (_.isUndefined(gameData.script)) {
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
 * @param {{ tag: string, data: Buffer }[]} blocks "Image" blocks
 * @param {string} streamName Name of the stream, e.g. "Image0"
 * @returns {[ Buffer, { stream: string, name: string, path: string, width: number, height: number }]}
 */
function parseImage(blocks, streamName) {
	let meta = { stream: streamName };
	let data = null;
	blocks.forEach(block => {
		switch (block.tag) {
			case 'NAME': meta.name = parseString(block.data); break;
			case 'PATH': meta.path = parseString(block.data).replace(/\\+/g, '\\'); break;
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
 * @returns  {[ Buffer, { stream: string, name: string, path: string, id: string }]}
 */
function parseSound(blocks, streamName) {
	return [ blocks[3], {
		stream: streamName,
		name: blocks[0].toString('utf8'),
		path: blocks[1].toString('utf8').replace(/\\/g, '/'),
		id: blocks[2].toString('utf8')
	} ];
}

/**
 * Parses data from a game item stream.
 *
 * No idea how to distinguish between different game items, so we just try to
 * parse the name, which seems to be common.
 *
 * @param {{ tag: string, data: Buffer }[]} blocks "GameItem" blocks
 * @param {string} streamName Name of the stream, e.g. "GameItem0"
 * @returns {{ stream: string, name: string }}
 */
function parseGameItem(blocks, streamName) {
	let meta = { stream: streamName };
	blocks.forEach(block => {
		switch (block.tag) {
			case 'NAME': meta.name = parseString16(block.data); break;
		}
	});
	return meta;
}

/**
 * Parses data from a collection stream.
 *
 * @param {{ tag: string, data: Buffer }[]} blocks "Collection" blocks
 * @param {string} streamName Name of the stream, e.g. "Collection0"
 * @returns {{ stream: string, name: string }}
 */
function parseCollection(blocks, streamName) {
	let meta = { stream: streamName };
	blocks.forEach(block => {
		switch (block.tag) {
			case 'NAME': meta.name = parseString16(block.data); break;
		}
	});
	return meta;
}

/**
 * Parses a UTF-8 string from a block.
 *
 * @param {Buffer} block Block to parse
 * @returns {string} String
 */
function parseString(block) {
	return block.slice(4).toString('utf8');
}

/**
 * Parses a UTF-16 string from a block.
 *
 * @param {Buffer} block Block to parse
 * @returns {string} String
 */
function parseString16(block) {
	let chars = [];
	block.slice(4).forEach((v, i, b) => {
		if (i % 2 == 0) {
			chars.push(v);
		}
	});
	return new Buffer(chars).toString('utf8');
}

/**
 * Returns block data for saving to the database.
 *
 * @param {Buffer} data Data to hash
 * @param {string} type Item type (image, sound, gameitem, collection)
 * @param {object} meta Parsed metadata
 * @returns {{ hash: Buffer, bytes: number, type: string, meta: object }}
 */
function analyzeBlock(data, type, meta) {
	if (!data) {
		return console.error('Ignoring empty data for %s.', meta.stream);
	}
	return {
		hash: crypto.createHash('md5').update(data).digest(),
		bytes: data.length,
		type: type,
		meta: meta
	};
}