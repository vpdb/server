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
var gm = require('gm');
var logger = require('winston');

var PngQuant = require('pngquant');
var OptiPng = require('optipng');

var error = require('../error')('processor', 'image');
var mimeTypes = require('../mimetypes');

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
		logo: [
			{ name: 'medium',    width: 300, height: 600, mimeType: 'image/png' },
			{ name: 'medium-2x', width: 600, height: 1200, mimeType: 'image/png' }
		],
		backglass: [
			{ name: 'medium',    width: 364, height: 291, mimeType: 'image/jpeg' },
			{ name: 'medium-2x', width: 728, height: 582, mimeType: 'image/jpeg' },
			{ name: 'small',     width: 253, height: 202, mimeType: 'image/jpeg' },
			{ name: 'small-2x',  width: 506, height: 404, mimeType: 'image/jpeg' }
		],
		'playfield-fs': [
			{ name: 'medium',              width: 393, height: 233, rotate: -90, mimeType: 'image/jpeg' },
			{ name: 'medium-2x',           width: 786, height: 466, rotate: -90, mimeType: 'image/jpeg' },
			{ name: 'medium-landscape',    width: 393, height: 233, mimeType: 'image/jpeg' },
			{ name: 'medium-landscape-2x', width: 786, height: 466, mimeType: 'image/jpeg' },
			{ name: 'square',    portraitToSquare: true, size: 120, mimeType: 'image/jpeg' },
			{ name: 'square-2x', portraitToSquare: true, size: 240, mimeType: 'image/jpeg' }
		],
		'playfield-ws': [
			// todo: rename medium to medium-portrait and perspective-distort it to portrait-ish
			{ name: 'medium',    width: 393, height: 393, mimeType: 'image/jpeg' },
			{ name: 'medium-2x', width: 786, height: 786, mimeType: 'image/jpeg' },
			{ name: 'medium-landscape',    width: 393, height: 233, mimeType: 'image/jpeg' },
			{ name: 'medium-landscape-2x', width: 786, height: 466, mimeType: 'image/jpeg' },
			{ name: 'square',    wideToSquare: true, size: 120, mimeType: 'image/jpeg' },
			{ name: 'square-2x', wideToSquare: true, size: 240, mimeType: 'image/jpeg' }
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
			return done(error(err, 'Error reading metadata from image').warn());
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

ImageProcessor.prototype.preprocess = function(file, done) {

	// rotate if necessary
	if (file.file_type === 'playfield-fs') {
		gm(file.getPath()).identify(function(err, metadata) {
			if (err) {
				// just return, this is handled by metadata
				return done();
			}
			if (_.isObject(metadata.size) && metadata.size.height > metadata.size.width) {
				logger.info('[processor|image|pre] Rotating FS playfield image.');
				gm(file.getPath()).rotate('black', 90).write(file.getPath(), done);
			} else {
				done();
			}
		});
	} else {
		done();
	}
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
ImageProcessor.prototype.pass1 = function(src, dest, file, variation, done) {

	// create destination stream
	var writeStream = fs.createWriteStream(dest);
	logger.info('[processor|image|pass1] Starting processing %s at %s.', file.toString(variation), dest);

	// setup error handler
	var handleErr = function(err) {
		done(error(err, 'Error processing %s', file.toString(variation)).log('pass1'));
	};

	// setup success handler
	writeStream.on('finish', function() {
		logger.info('[processor|image|pass1] Saved resized image to "%s".', dest);
		done();
	});
	writeStream.on('error', handleErr);

	// do the processing
	logger.info('[processor|image|pass1] Resizing %s "%s" (%s)...', file.file_type, file.id, variation.name);
	var img = gm(src);
	img.quality(80);

	if (variation.width && variation.height) {
		img.resize(variation.width, variation.height);
	}

	if (variation.rotate) {
		img.rotate('black', variation.rotate);
	}

	var srcSize, scale;
	if (variation.portraitToSquare) {
		srcSize = file.metadata.size;
		scale = srcSize.width / 1920;
		img.rotate('black', -120);
		img.crop(300 * scale, 300 * scale, 950 * scale, 1300 * scale);
		if (variation.size) {
			img.resize(variation.size, variation.size);
		}
	}
	if (variation.wideToSquare) {
		srcSize = file.metadata.size;
		scale = srcSize.width / 1920;
		img.rotate('black', -30);
		img.crop(220 * scale, 220 * scale, 1020 * scale, 970 * scale);
		if (variation.size) {
			img.resize(variation.size, variation.size);
		}
	}

	if (variation.mimeType && mimeTypes[variation.mimeType]) {
		img.setFormat(mimeTypes[variation.mimeType].ext);
	}

	img
		.stream().on('error', handleErr)
		.pipe(writeStream).on('error', handleErr);
};

/**
 * If PNG image, crunches the image down.
 *
 * @param {string} src Path to source file
 * @param {string} dest Path to destination
 * @param {File} file File to process
 * @param {object} variation Variation of the file to process
 * @param {function} done Callback, ran with none or {Err} object as parameter.
 */
ImageProcessor.prototype.pass2 = function(src, dest, file, variation, done) {

	if (file.getMimeSubtype(variation) !== 'png') {
		logger.info('[processor|image|pass2] Skipping pass 2 for %s (image type %s)', file.toString(variation), file.getMimeSubtype());
		return done();
	}

	// create destination stream
	var writeStream = fs.createWriteStream(dest);

	// setup success handler
	writeStream.on('finish', function() {
		logger.info('[processor|image|pass2] Finished pass 2 for %s', file.toString(variation));
		done();
	});

	// setup error handler
	var handleErr = function(what) {
		return function(err) {
			done(error(err, 'Error at %s while processing %s', what, file.toString(variation)).log('pass2'));
		};
	};
	writeStream.on('error', handleErr);

	// do the processing
	var quanter = new PngQuant([128]);
	var optimizer = new OptiPng(['-o7']);

	logger.info('[processor|image|pass2] Optimizing %s %s', file.getMimeSubtype(variation), file.toString(variation));
	fs.createReadStream(src).on('error', handleErr('reading'))
		.pipe(quanter).on('error', handleErr('quanter'))
		.pipe(optimizer).on('error', handleErr('optimizer'))
		.pipe(writeStream).on('error', handleErr('writing'));
};

module.exports = new ImageProcessor();