/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var _ = require('underscore');
var fs = require('fs');
var gm = require('gm');
var logger = require('winston');

var PngQuant = require('pngquant');
var OptiPng = require('optipng');

var config = require('../settings').current;


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
function ImageProcessor() {
	this.name = 'image';

	this.variations = {
		backglass: [
			{ name: 'medium',    width: 364, height: 291 },
			{ name: 'medium-2x', width: 728, height: 582 },
			{ name: 'small',     width: 253, height: 202 },
			{ name: 'small-2x',  width: 506, height: 404 }
		],
		playfield: [
			{ name: 'medium',    width: 393, height: 233 },
			{ name: 'medium-2x', width: 786, height: 466 }
		]
	};
}

ImageProcessor.prototype.metadata = function(file, variation, done) {
	if (_.isFunction(variation)) {
		done = variation;
		variation = undefined;
	}
	gm(file.getPath(variation)).identify(function(err, metadata) {
		if (err) {
			logger.warn('[storage] Error reading metadata from image: %s', err);
			return done(err);
		}
		done(null, metadata);
	});
};

ImageProcessor.prototype.metadataShort = function(metadata) {
	return _.pick(metadata, 'format', 'size', 'depth', 'JPEG-Quality');
};

ImageProcessor.prototype.variationData = function(metadata) {
	return {
		width: metadata.size.width,
		height: metadata.size.height
	};
};

/**
 * Resizes the image
 *
 * @param file
 * @param variation
 * @param done
 * @returns {*}
 */
ImageProcessor.prototype.pass1 = function(file, variation, done) {

	// check for source file availability
	if (!fs.existsSync(file.getPath())) {
		logger.warn('[image|pass1] File "%s" not available anymore, aborting.', file.getPath());
		return done('File "' + file.getPath() + '" gone, has been removed before processing finished.');
	}

	// create destination stream
	var dest = file.getPath(variation);
	var writeStream = fs.createWriteStream(dest);
	logger.info('[image|pass1] Setup write stream at %s.', dest);
	var handleErr = function(err) {
		logger.error('[image|pass1] Error processing %s "%s" (%s)...', file.file_type, file.id, variation.name);
		done(err);
	};
	writeStream.on('finish', function() {
		logger.info('[image|pass1] Saved resized image to "%s".', dest);
		done();
	});
	writeStream.on('error', handleErr);

	var srcPath = file.getPath();
	logger.info('[image|pass1] Resizing %s "%s" (%s)...', file.file_type, file.id, variation.name);
	gm(srcPath).resize(variation.width, variation.height)
		.stream().on('error', handleErr)
		.pipe(writeStream).on('error', handleErr);
};

/**
 * If PNG image, crunches the image down.
 *
 * @param file
 * @param variation
 * @param done
 * @returns {*}
 */
ImageProcessor.prototype.pass2 = function(file, variation, done) {

	// check for source file availability
	var variationLogName = variation ? variation.name : 'original';
	var src = file.getPath(variation);
	if (!fs.existsSync(src)) {
		logger.warn('[image|pass2] File "%s" not available anymore, aborting.', src);
		return done('File "' + src + '" gone, has been removed before processing finished.');
	}

	if (file.getMimeSubtype() !== 'png') {
		return done('Skipping pass 2 for image type "' + file.getMimeSubtype() + '".');
	}

	// create destination stream
	var dest = src + '_processing';
	var writeStream = fs.createWriteStream(dest);

	// setup success handler
	writeStream.on('finish', function() {
		logger.info('[image|pass2] Finished pass 2 for %s "%s" (%s)...', file.file_type, file.id, variationLogName);
		if (fs.existsSync(src) && fs.existsSync(dest)) {
			fs.unlinkSync(src);
			fs.rename(dest, src, done);
		} else {
			done();
		}
	});

	// setup error handler
	var handleErr = function(err) {
		logger.error('[image|pass2] Error processing %s "%s" (%s)...', file.file_type, file.id, variationLogName);
		done(err);
	};
	writeStream.on('error', handleErr);

	// do the processing
	var quanter = new PngQuant([128]);
	var optimizer = new OptiPng(['-o7']);

	logger.info('[image|pass2] Optimizing %s "%s" (%s)...', file.file_type, file.id, variationLogName);
	fs.createReadStream(src)
		.pipe(quanter).on('error', handleErr)
		.pipe(optimizer).on('error', handleErr)
		.pipe(writeStream).on('error', handleErr);
};

module.exports = new ImageProcessor();