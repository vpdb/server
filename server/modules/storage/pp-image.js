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

var File = require('mongoose').model('File');
var PngQuant = require('pngquant');
var OptiPng = require('optipng');

var config = require('../settings').current;

exports.postprocess = function(file, done) {

	if (config.vpdb.skipImageOptimizations) {
		return done();
	}
	if (file.getMimeSubtype() !== 'png') {
		return done();
	}
	if (!fs.existsSync(file.getPath())) {
		return done();
	}

	var handleErr = function(err) {
		done(err);
	};

	var tmppath = file.getPath() + '_tmp';
	var writeStream = fs.createWriteStream(tmppath);
	writeStream.on('finish', function() {
		logger.info('[storage|image] All done, switching images..');
		if (fs.existsSync(file.getPath())) {
			fs.unlinkSync(file.getPath());
		}
		if (fs.existsSync(tmppath)) {
			fs.rename(tmppath, file.getPath(), done);
		} else {
			done();
		}
	});
	writeStream.on('error', handleErr);

	var quanter = new PngQuant([128]);
	var optimizer = new OptiPng(['-o7']);

	logger.info('[storage|image] Optimizing %s "%s"...', file.file_type, file.name);
	fs.createReadStream(file.getPath())
		.pipe(quanter).on('error', handleErr)
		.pipe(optimizer).on('error', handleErr)
		.pipe(writeStream).on('error', handleErr);
};


exports.postprocessVariation = function(queue, file, variation, next) {

	queue.emit('started', file, variation);
	logger.info('[storage|image] Starting image processing of "%s" variation "%s"...', file.id, variation.name);

	if (!fs.existsSync(file.getPath())) {
		logger.warn('[storage|image] File "%s" not available anymore, aborting.', file.getPath());
		return next('File "' + file.getPath() + '" gone, has been removed before processing finished.');
	}

	var filepath = file.getPath(variation.name);
	var writeStream = fs.createWriteStream(filepath);
	logger.info('[storage|image] Setup write stream at %s.', filepath);
	var handleErr = function(err) {
		logger.error('[storage|image] Error: ' + err);
		next(err);
	};
	writeStream.on('finish', function() {
		logger.info('[storage|image] Saved resized image to "%s".', filepath);

		if (!fs.existsSync(filepath)) {
			return next('File "' + filepath + '" gone, has been removed before processing finished.');
		}

		// update database with new variation
		gm(filepath).identify(function(err, value) {
			if (err) {
				logger.warn('[storage|image] Error reading metadata from image: %s', err);
				return next();
			}

			// re-fetch so we're sure no updates are lost
			var fileId = file.id;
			File.findById(file._id, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.warn('[storage|image] Error re-fetching image: %s', err);
					return next(err);
				}

				// check that file hasn't been erased meanwhile (hello, tests!)
				if (!file) {
					return next('File "' + fileId + '" gone, has been removed before processing finished.');
				}
				if (!fs.existsSync(filepath)) {
					return next('File "' + filepath + '" gone, has been deleted before processing finished.');
				}

				if (!file.variations) {
					file.variations = {};
				}

				file.variations[variation.name] = {
					bytes: fs.statSync(filepath).size,
					width: value.size.width,
					height: value.size.height
				};

				logger.info('[storage|image] Updating file "%s" with variation %s.', file.id, variation.name);

				// change to file.save when fixed: https://github.com/LearnBoost/mongoose/issues/1694
				File.findOneAndUpdate({ _id: file._id }, _.omit(file.toJSON(), [ '_id', '__v' ]), {}, function(err) {
					queue.emit('finished', file, variation);
					next(err);
				});
			});
		});
	});
	writeStream.on('error', handleErr);

	if (file.getMimeSubtype() === 'png') {

		if (config.vpdb.skipImageOptimizations) {
			var srcPath = file.getPath();
			logger.info('[storage|image] Resizing "%s" for %s %s...', file.name, variation.name, file.file_type);
			gm(srcPath).resize(variation.width, variation.height)
				.stream().on('error', handleErr)
				.pipe(writeStream).on('error', handleErr);

		} else {
			var quanter = new PngQuant([128]);
			var optimizer = new OptiPng(['-o7']);

			logger.info('[storage|image] Resizing and optimizing "%s" for %s %s...', file.name, variation.name, file.file_type);
			gm(file.getPath()).resize(variation.width, variation.height).stream()
				.pipe(quanter).on('error', handleErr)
				.pipe(optimizer).on('error', handleErr)
				.pipe(writeStream).on('error', handleErr);
		}

	} else {
		logger.info('[storage|image] Resizing "%s" for %s %s...', file.name, variation.name, file.file_type);
		gm(file.getPath())
			.resize(variation.width, variation.height).stream()
			.pipe(writeStream).on('error', handleErr);
	}
};