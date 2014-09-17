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

var _ = require('lodash');
var fs = require('fs');
var gm = require('gm');
var logger = require('winston');

var PngQuant = require('pngquant');
var OptiPng = require('optipng');

var error = require('../error')('processor', 'image');

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
	gm(src).resize(variation.width, variation.height)
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

	if (file.getMimeSubtype() !== 'png') {
		return done('Skipping pass 2 for image type "' + file.getMimeSubtype() + '".');
	}

	// create destination stream
	var writeStream = fs.createWriteStream(dest);

	// setup success handler
	writeStream.on('finish', function() {
		logger.info('[processor|image|pass2] Finished pass 2 for %s', file.toString(variation));
		done();
	});

	// setup error handler
	var handleErr = function(err) {
		done(error(err, 'Error processing %s', file.toString(variation)).log('pass2'));
	};
	writeStream.on('error', handleErr);

	// do the processing
	var quanter = new PngQuant([128]);
	var optimizer = new OptiPng(['-o7']);

	logger.info('[processor|image|pass2] Optimizing %s', file.toString(variation));
	fs.createReadStream(src).on('error', handleErr)
		.pipe(quanter).on('error', handleErr)
		.pipe(optimizer).on('error', handleErr)
		.pipe(writeStream).on('error', handleErr);
};

module.exports = new ImageProcessor();