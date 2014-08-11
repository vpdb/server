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
var logger = require('winston');
var ffmpeg = require('fluent-ffmpeg');

var File = require('mongoose').model('File');

var config = require('../settings').current;

exports.postprocess = function(queue, file, done) {

	if (!fs.existsSync(file.getPath())) {
		return done();
	}
	done();
};

exports.postprocessVariation = function(queue, file, variation, next) {

	queue.emit('started', file, variation);
	logger.info('[storage|video] Starting video processing of "%s" variation "%s"...', file.id, variation.name);

	if (!fs.existsSync(file.getPath())) {
		logger.warn('[storage|video] File "%s" not available anymore, aborting.', file.getPath());
		return next('File "' + file.getPath() + '" gone, has been removed before processing finished.');
	}

	var filepath = file.getPath(variation.name);
	var started = new Date().getTime();
	ffmpeg(file.getPath())
		.noAudio()
		.videoCodec('libx264')
		.size(variation.height + 'x' + variation.width)
		.videoFilters('transpose=2')
		.on('error', function(err) {
			logger.error('[storage|video] ' + err);
			next(err);
		})
		.on('progress', function(progress) {
			logger.info('[storage|video] Processing: %s% at %skbps', progress.percent, progress.currentKbps);
		})
		.on('end', function() {
			logger.info('[storage|video] Transcoding succeeded after %dms, written to %s', new Date().getTime() - started, filepath);
			next();
		})
		.save(filepath);
};