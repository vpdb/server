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
const logger = require('winston');
const ffmpeg = Promise.promisifyAll(require('fluent-ffmpeg'));

const config = require('../../../src/common/settings').current;
const error = require('../error')('processor', 'video');

/**
 * Video processor.
 *
 * Pass 1
 * Creates the screenshots from the video
 *
 * Pass 2
 * Re-encodes the video if necessary and processes video-resizes
 *
 * @constructor
 */
function VideoProcessor() {

	// force ffmpeg path if set
	if (config.ffmpeg && config.ffmpeg.path) {
		ffmpeg.setFfmpegPath(config.ffmpeg.path);
	}

	this.name = 'video';

	this.variations = {
		'playfield-fs': [
			{ name: 'still',         mimeType: 'image/png', screenshot: true, position: '0:0.500' },
			{ name: 'small-rotated', mimeType: 'video/mp4', width: 394, height: 234, rotate: true }
		],
		'playfield-ws': [
			{ name: 'still',         mimeType: 'image/png', screenshot: true, position: '0:0.500' },
			{ name: 'small-rotated', mimeType: 'video/mp4', width: 394, height: 234 }
		]
	};
}

VideoProcessor.prototype.metadata = function(file, variation) {

	return Promise.try(function() {
		return ffmpeg.ffprobeAsync(file.getPath(variation));

	}).catch(err => {
		// log this
		throw error(err, 'Error reading metadata from video `%s`', file.getPath(variation)).warn();
	});
};

VideoProcessor.prototype.metadataShort = function(metadata) {
	let short = {};
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

// eslint-disable-next-line no-unused-vars
VideoProcessor.prototype.variationData = function(metadata) {
	// TODO
	return {
		todo: 'no joke.'
	};
};


/**
 * If the variation is a still, extract still, otherwise skip
 *
 * @param {File} file
 * @param {object} variation
 * @returns {Promise}
 */
VideoProcessor.prototype.pass1 = function(src, dest, file, variation) {

	return new Promise((resolve, reject) => {

		// only do screenshots in first pass.
		if (!variation.screenshot) {
			return resolve(true);
		}

		logger.debug('[video|pass1] Starting processing %s at %s.', file.toString(variation), dest);
		const started = new Date().getTime();
		ffmpeg(src)
			.noAudio()
			.frames(1)
			.seek(variation.position || '0:01')
			.on('start', function(commandLine) {
				logger.debug('[video|ffmpeg] %s', commandLine);
			})
			.on('error', function(err, stdout, stderr) {
				logger.error('[video|pass1] ' + err);
				logger.error('[ffmpeg|stdout] ' + stdout);
				logger.error('[ffmpeg|stderr] ' + stderr);
				reject(error(err, 'Error processing video'));
			})
			.on('progress', function(progress) {
				logger.debug('[video|pass1] Processing: %s% at %skbps', progress.percent, progress.currentKbps);
			})
			.on('end', function() {
				logger.debug('[video|pass1] Transcoding succeeded after %dms, written to %s', new Date().getTime() - started, dest);
				resolve();
			})
			.save(dest);

	});
};

/**
 * If PNG image, crunches the image down.
 *
 * @param {File} file
 * @param {object} variation
 * @param {string} dest Where the file should be written to
 * @returns {Promise}
 */
VideoProcessor.prototype.pass2 = function(src, dest, file, variation) {

	return new Promise((resolve, reject) => {

		// only do videos in second pass.
		if (variation && variation.screenshot) {
			return resolve();
		}

		logger.info('[video|pass2] Starting video processing of %s', file.toString(variation));
		if (!variation) {
			const md = this.metadataShort(file.metadata);
			if (md.video.bit_rate < 4000000 && /^[hx]264$/.test(md.video.codec_name)) {
				logger.info('[video|pass2] Original video seems okay (%s mpbs, %s), skipping re-processing.', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
				return resolve();
			} else {
				logger.info('[video|pass2] Re-processing original video (%s mpbs, %s)', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
			}
		}
		const started = new Date().getTime();
		const proc = ffmpeg(src)
			.noAudio()
			.videoCodec('libx264')
			.on('start', function(commandLine) {
				logger.info('[video|ffmpeg] %s', commandLine);
			})
			.on('error', function(err, stdout, stderr) {
				logger.error('[video|pass2] ' + err);
				logger.error('[ffmpeg|stdout] ' + stdout);
				logger.error('[ffmpeg|stderr] ' + stderr);
				reject(error(err, 'Error processing video'));
			})
			.on('progress', function(progress) {
				if (progress.percent) {
					logger.info('[video|pass2] Processing %s: %s%', file.toString(variation), Math.round(progress.percent * 100) / 100);
				}

			})
			.on('end', function() {
				logger.info('[video|pass2] Transcoding succeeded after %dms, written to %s', new Date().getTime() - started, dest);
				resolve();
			});
		if (variation && variation.height && variation.width) {
			proc.size(variation.height + 'x' + variation.width);
		}
		if (variation && variation.rotate) {
			proc.videoFilters('transpose=2');
		}
		proc.save(dest);

	});
};

module.exports = new VideoProcessor();
