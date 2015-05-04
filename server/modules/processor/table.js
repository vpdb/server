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
var fs = require('fs');
var path = require('path');
var logger = require('winston');
var request = require('request');

var error = require('../error')('processor', 'table');

/**
 * Image processor.
 *
 * Pass 1
 * Resizes the image
 *
 * Pass 2
 * Crunches PNG files using pngquant and optipng.
 *
 * @constructor
 */
function TableProcessor() {
	this.name = 'table';

	this.variations = {
		release: [
			{ name: 'screenshot' }
		]
	};
}

TableProcessor.prototype.metadata = function(file, variation, done) {
	if (_.isFunction(variation)) {
		done = variation;
		variation = undefined;
	}
	done(null, {});
};

TableProcessor.prototype.metadataShort = function(metadata) {
	return {};
};

TableProcessor.prototype.variationData = function(metadata) {
	return {};
};

/**
 * Resizes the image.
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @param {function} done Callback, ran with none or {Err} object as parameter.
 */
TableProcessor.prototype.pass1 = function(src, dest, file, variation, done) {

	logger.info('[processor|table|pass1] OK I am running.');

	var formData = {
		tablefile: {
			value:  fs.createReadStream(src),
			options: {
				filename: path.basename(src),
				contentType: 'application/octet-stream'
			}
		}
	};
	request.post({ url:'http://vpdbproc.gameex.com/vppublish.aspx?type=upload&ver=9', formData: formData}, function(err, resp, body) {
		if (err) {
			logger.error('[processor|table|pass1]: %s', err);
		} else {
			logger.error('Body: %s', body);
		}
		done();
	});
};

module.exports = new TableProcessor();