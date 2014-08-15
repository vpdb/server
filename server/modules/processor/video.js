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

var config = require('../settings').current;

exports.metadata = function(file, variation, done) {
	if (_.isFunction(variation)) {
		done = variation;
		variation = undefined;
	}

	ffmpeg.ffprobe(file.getPath(variation), function(err, metadata) {
		if (err) {
			logger.warn('[storage] Error reading metadata from video (%s): %s', file.getPath(), err);
			return done(err);
		}
		done(null, metadata);
	});
};

exports.metadataShort = function(metadata) {
	var short = {};
	if (metadata.format) {
		short = _.pick(metadata.format, 'format_name', 'format_long_name', 'duration', 'bit_rate');
	}
	if (metadata.streams) {
		_.each(metadata.streams, function(stream) {
			if (stream.codec_type === 'video' && !short.video) {
				short.video = _.pick(stream, 'codec_name', 'width', 'height', 'display_aspect_ratio', 'bit_rate');
			}
			if (stream.codec_type === 'audio' && !short.audio) {
				short.video = _.pick(stream, 'codec_name', 'sample_rate', 'channels', 'bit_rate');
			}
		});
	}
	return short;
};

exports.variationData = function(metadata) {
	return {
	};
};


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