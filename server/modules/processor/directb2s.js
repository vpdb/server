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

const _ = require('lodash');
const fs = require('fs');
const gm = require('gm');
const sax = require('sax');
const logger = require('winston');
const base64 = require('base64-stream');
const PngQuant = require('pngquant');
const Readable = require('stream').Readable;

const Parser = require('../sax-async');
const error = require('../error')('processor', 'directb2s');
const mimeTypes = require('../mimetypes');

Promise.promisifyAll(gm.prototype);

/**
 * Direct B2S Backglass processor
 *
 * Pass 1
 * Extract thumbnails
 *
 * Pass 2
 * Crunch PNG resources with pngquand
 * No optipng for performance reasons, 700% more processing time for 2% less space
 *
 * @constructor
 */
function Directb2sProcessor() {
	this.name = 'directb2s';
	this.variations = {
		backglass: [
			{ name: 'full',                               mimeType: 'image/jpeg', cutGrill: false },
			{ name: 'medium',    width: 364, height: 291, mimeType: 'image/jpeg', cutGrill: true },
			{ name: 'medium-2x', width: 728, height: 582, mimeType: 'image/jpeg', cutGrill: true },
			{ name: 'small',     width: 253, height: 202, mimeType: 'image/jpeg', cutGrill: true },
			{ name: 'small-2x',  width: 506, height: 404, mimeType: 'image/jpeg', cutGrill: true }
		]
	};
}

Directb2sProcessor.prototype.metadata = function(file, variation) {

	return Promise.try(() => {
		if (!variation) {
			return new Promise((resolve, reject) => {
				let now = new Date().getTime();
				let metadata = {};
				let saxStream = sax.createStream(true);
				saxStream.on("error", reject);
				saxStream.on("opentag", node => {
					switch (node.name) {
						case 'DirectB2SData': metadata.version = node.attributes.Version; break;
						case 'Name': metadata.name = node.attributes.Value; break;
						case 'TableType': metadata.table_type = node.attributes.Value; break;
						case 'DMDType': metadata.dmd_type = node.attributes.Value; break;
						case 'GrillHeight': metadata.grill_height = node.attributes.Value; break;
						case 'DualBackglass': metadata.dual_backglass = node.attributes.Value; break;
						case 'Author': metadata.author = node.attributes.Value; break;
						case 'Artwork': metadata.artwork = node.attributes.Value; break;
						case 'GameName': metadata.gamename = node.attributes.Value; break;
					}
				});
				saxStream.on("end", () => {
					logger.info('[processor|directb2s|metadata] Retrieved metadata in %sms.', new Date().getTime() - now);
					resolve(metadata);
				});
				fs.createReadStream(file.getPath()).on('error', reject)
					.pipe(saxStream).on('error', reject);
			});

		} else {
			return gm(file.getPath(variation)).identifyAsync();
		}

	}).catch(err => {
		// log this
		throw error(err, 'Error reading metadata from DirectB2S Backglass').warn();
	});
};

Directb2sProcessor.prototype.metadataShort = function(metadata) {
	if (metadata.gamename) {
		return _.pick(metadata, 'name', 'version', 'author', 'gamename');
	}
	return _.pick(metadata, 'format', 'size', 'depth', 'JPEG-Quality');
};

Directb2sProcessor.prototype.variationData = function(metadata) {
	return {
		width: metadata.size.width,
		height: metadata.size.height
	};
};

/**
 * Extracts the backglass image from the directb2s file.
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @returns {Promise}
 */
Directb2sProcessor.prototype.pass1 = function(src, dest, file, variation) {

	return Promise.try(() => {

		const now = new Date().getTime();
		logger.debug('[processor|directb2s|pass1] Starting processing %s at %s.', file.toString(variation), dest);
		return new Promise((resolve, reject) => {

			logger.debug('[processor|directb2s|pass1] Reading DirectB2S Backglass %s...', src);
			let parser = new Parser(src);
			let currentTag;
			parser.on('opentagstart', tag => {
				currentTag = tag.name;
			});
			parser.on('attribute', attr => {
				if (currentTag === 'BackglassImage' && attr.name === 'Value') {

					logger.debug('[processor|directb2s|pass1] Found backglass image, pausing XML parser...');
					parser.pause();
					let source = new Readable();
					source._read = function () {
						source.push(attr.value);
						source.push(null);
					};

					let imgStream = source.on('error', reject).pipe(base64.decode()).on('error', reject);

					// setup gm
					let img = gm(imgStream);

					img.size({ bufferStream: true }, function(err, size) {

						img.quality(variation.qual || 70);
						img.interlace('Line');

						if (variation.cutGrill && file.metadata.grill_height && size) {
							img.crop(size.width, size.height - file.metadata.grill_height, 0, 0);
							logger.info(size);
							logger.info('[processor|directb2s|pass1] Cutting off grill for variation %s, new height = ', file.toString(variation), size.height - file.metadata.grill_height);
						}

						if (variation.width && variation.height) {
							img.resize(variation.width, variation.height);
						}

						if (variation.mimeType && mimeTypes[variation.mimeType]) {
							img.setFormat(mimeTypes[variation.mimeType].ext);
						}

						let writeStream = fs.createWriteStream(dest);

						// setup success handler
						writeStream.on('finish', function() {
							logger.info('[processor|directb2s|pass1] Saved resized image to "%s" (%sms).', dest, new Date().getTime() - now);
							parser.resume();

						});
						writeStream.on('error', reject);

						img.stream().on('error', reject).pipe(writeStream).on('error', reject);


					});
				}
			});
			parser.on('error', err => {
				reject(error(err, 'Error parsing direct2b file at %s', file.toString(variation)).log('pass1'));
			});

			parser.on('end', resolve);
			parser.stream(true);
		});
	});
};

/**
 * Crunches all images of the directb2s file
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @returns {Promise}
 */
Directb2sProcessor.prototype.pass2 = function(src, dest, file, variation) {

	return Promise.try(() => {

		if (file.getMimeSubtype(variation) !== 'x-directb2s') {
			logger.debug('[processor|directb2s|pass2] Skipping pass 2 for %s (type %s)', file.toString(variation), file.getMimeSubtype());
			return Promise.resolve();
		}

		logger.debug('[processor|directb2s|pass2] Starting processing %s at %s.', file.toString(variation), dest);
		return new Promise((resolve, reject) => {

			const now = new Date().getTime();
			let originalSize = fs.statSync(src).size;
			let out = fs.createWriteStream(dest);
			let parser = new Parser(src);
			let closePrevious = '';
			let emptyElement;
			let level = 0;
			let currentTag;

			let write = function(text) {
				out.write(text);
				//process.stdout.write(text);
			};

			parser.on('opentagstart', tag => {
				let name = tag.name;
				level++;
				emptyElement = true;
				write(closePrevious);
				write('<' + name);
				closePrevious = '>';
				currentTag = name;
			});

			parser.on('attribute', attr => {
				if ((currentTag === 'Bulb' && attr.name === 'Image') ||
					(currentTag === 'BackglassImage' && attr.name === 'Value') ||
					(currentTag === 'ThumbnailImage' && attr.name === 'Value')) {

					parser.pause();
					let source = new Readable();
					let started = false;
					let quanter = new PngQuant([192, '--ordered']);
					let handleError = function(err) {
						console.error('ERROR: %s', err.message);
						if (!started) {
							write(' ' + attr.name + '="');
							write(escape(attr.value));
						}
						write('"');
						parser.resume();
					};
					source.on('error', handleError)
						.pipe(base64.decode()).on('error', handleError)
						.pipe(quanter).on('error', handleError)
						.pipe(base64.encode()).on('error', handleError)
						.on('data', data => {
							if (!started) {
								write(' ' + attr.name + '="');
							}
							write(data);
							started = true;
						})
						.on('end', () => {
							write('"');
							parser.resume();
						});

					source.push(attr.value);
					source.push(null);
				} else {
					write(' ' + attr.name + '="');
					write(escape(attr.value));
					write('"');
				}
			});

			parser.on('text', text => {
				if (text) {
					emptyElement = false;
					write(closePrevious);
					write(text);
					closePrevious = '';
				} else {
					emptyElement = true;
				}
			});

			parser.on('closetag', name => {
				level--;
				if (emptyElement) {
					write('/>');
				} else {
					write('</' + name + '>');
				}
				closePrevious = '';

				if (level === 0) {
					out.end();
					let crushedSize = fs.statSync(dest).size;
					logger.debug('[processor|directb2s|pass2] Optimized "%s" in %sms (crushed down to %s%%).', dest, new Date().getTime() - now, Math.round(crushedSize / originalSize * 100));
					resolve();
				}
			});

			parser.on('opencdata', () => {
				emptyElement = false;
				write(closePrevious);
				write('<![CDATA[');
				closePrevious = '';
			});

			parser.on('cdata', text => {
				write(text);
			});

			parser.on('closecdata', () => {
				write(']]>');
				emptyElement = false;
			});

			parser.on('comment', comment => {
				emptyElement = false;
				write(closePrevious);
				write('<!--' + comment + '-->');
				closePrevious = '';
			});

			parser.on('processinginstruction', instr => {
				emptyElement = false;
				write(closePrevious);
				write('<?' + instr.name + ' ' + instr.body + '?>');
				closePrevious = '';
			});

			parser.on('error', err => {
				reject(error(err, 'Error parsing direct2b file at %s', file.toString(variation)).log('pass2'));
			});

			parser.stream(true);
		});
	});
};

module.exports = new Directb2sProcessor();

function escape(string) {
	let pattern;
	if (string === null || string === undefined) return;
	const map = {
		'>': '&gt;',
		'<': '&lt;',
		"'": '&apos;',
		'"': '&quot;',
		'&': '&amp;',
		'\r': '&#xD;',
		'\n': '&#xA;'
	};
	pattern = '([&"<>\'\n\r])';
	return string.replace(new RegExp(pattern, 'g'), function(str, item) {
		return map[item];
	});
}