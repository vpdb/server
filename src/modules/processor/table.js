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
const gm = require('gm');
const path = require('path');
const logger = require('winston');
const request = require('request');

const vp = require('../visualpinball');
const error = require('../error')('processor', 'table');
const config = require('../settings').current;

/**
 * Image processor.
 *
 * Pass 1
 * Generate table screenshot through GameEx service
 *
 * Pass 2
 * Generate table blocks
 *
 * @constructor
 */
function TableProcessor() {
	this.name = 'table';
	this.variations = { release: [] };

	if (config.vpdb.generateTableScreenshot) {
		this.variations.release.push({ name: 'screenshot', mimeType: 'image/jpeg' });
	}
}

// eslint-disable-next-line no-unused-vars
TableProcessor.prototype.metadata = function(file, variation) {

	return Promise.try(function() {
		return vp.readScriptFromTable(file.getPath());

	}).then(script => {
		return vp.getTableInfo(file.getPath()).then(props => {
			return _.extend(props, { table_script: script.code });
		});

	}).catch(err => {
		// log this
		throw error(err, 'Error reading metadata from table').warn();

	});
};

TableProcessor.prototype.metadataShort = function(metadata) {
	return metadata;
};

TableProcessor.prototype.variationData = function(metadata) {
	return _.omit(metadata, 'table_script');
};

/**
 * Resizes the image.
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @returns {Promise}
 */
TableProcessor.prototype.pass1 = function(src, dest, file, variation) {

	return Promise.try(() => {

		if (!config.vpdb.generateTableScreenshot) {
			return Promise.resolve();
		}

		logger.info('[processor|table|pass1] Posting table to get screenshot...');

		var formData = {
			tablefile: {
				value:  fs.createReadStream(src),
				options: {
					filename: path.basename(src),
					contentType: 'application/octet-stream'
				}
			}
		};

		// create 0 byte file so downloads get blocked
		fs.closeSync(fs.openSync(dest, 'w'));

		return new Promise((resolve, reject) => {
			request.post({ url:'http://vpdbproc.gameex.com/vppublish.aspx?type=upload&ver=9', formData: formData }, function(err, resp, body) {

				if (err) {
					fs.unlinkSync(dest);
					return reject(error(err, 'Error uploading to screenshot service.').log('pass1'));
				}

				var status = /<status>([^<]+)/.test(body) ? body.match(/<status>([^<]+)/i)[1] : null;
				var ticket = /<ticket>([^<]+)/.test(body) ? body.match(/<ticket>([^<]+)/i)[1] : null;

				if (status !== 'done') {
					logger.warn('[processor|table|pass1] Failed generating screenshot: %s', body);
					fs.unlinkSync(dest);
					return reject(new Error('Screenshot service returned "' + status + '".'));
				}

				// create destination stream
				var writeStream = fs.createWriteStream(dest);
				logger.info('[processor|table|pass1] Retrieving screenshot...');

				// setup error handler
				var handleErr = function(err) {
					reject(error(err, 'Error processing %s', file.toString(variation)).log('pass1'));
				};

				// setup success handler
				writeStream.on('finish', function() {
					logger.info('[processor|table|pass1] Saved image to "%s".', dest);
					resolve();
				});
				writeStream.on('error', handleErr);

				var img = gm(request('http://vpdbproc.gameex.com/vppublish.aspx?type=getimage&ticket=' + ticket));
				img.quality(80);
				img.rotate('black', 180);
				img.setFormat('jpeg');

				img.stream().on('error', handleErr).pipe(writeStream).on('error', handleErr);
			});
		});
	});
};

/**
 * Update table blocks database
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @returns {Promise}
 */
TableProcessor.prototype.pass2 = function(src, dest, file, variation) {

	if (variation) {
		return Promise.resolve();
	}

	const TableBlock = require('mongoose').model('TableBlock');
	let blocks, dbBlocks;
	return Promise.try(() => {
		return vp.analyzeFile(src);

	}).then(b => {
		blocks = _.uniqWith(b, blockCompare);
		return TableBlock.where({ hash: { $in: _.map(blocks, 'hash') }}).exec();

	}).then(b => {
		dbBlocks = b;
		const newBlocks = _.differenceWith(blocks, dbBlocks, blockCompare);
		return Promise.each(newBlocks, block => {
			let newBlock = new TableBlock(block);
			newBlock._files = [file._id];
			return newBlock.save();

		});

	}).then(() => {
		return Promise.each(dbBlocks, block => {
			block._files.push(file._id);
			return block.save();
		});
	});
};

/**
 * Compares the hashes of two blocks.
 * @param {{ hash: Buffer }} b1
 * @param {{ hash: Buffer }} b2
 * @returns {boolean} True if hashes are equal, false otherwise.
 */
function blockCompare(b1, b2) {
	return b1.hash.equals(b2.hash);
}
module.exports = new TableProcessor();