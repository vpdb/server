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
var util = require('util');
var events = require('events');
var avconv = require('avconv');
var childProcess = require('child_process');

/**
 * A wrapper for Libav's `avconv` (fork of ffmpeg).
 *
 * DEPREACATED. Using ffmpeg.
 *
 * It is very basic and only supports features currently used by VPDB. The API
 * was inspired by the `fluent-ffmpeg` module.
 *
 * @see https://libav.org/avconv.html
 * @see https://libav.org/avprobe.html
 * @see https://www.ffmpeg.org/ffmpeg.html
 * @param {string} input Path to input file
 * @param {object} [options] command options
 * @param {object} [options.logger=<no logging>] logger object with 'error', 'warn' and 'info' methods
 * @returns {Libav} New wrapper instance
 * @constructor
 */
function Libav(input, options) {

	// Make 'new' optional
	if (!(this instanceof Libav)) {
		return new Libav(input, options);
	}
	events.EventEmitter.call(this);

	options = options || {};

	this.logger = options.logger || { error: function() {}, warn: function() {}, info: function() {} };
	this.input = input;
	this.error = false;
	this.out = '';
	this.params = {
		input: new Params('input'),
		video: new Params('video'),
		audio: new Params('audio'),
		output: new Params('output')
	};
	this.params.input.add('-i', input);
}
util.inherits(Libav, events.EventEmitter);
module.exports = Libav;

/**
 * Sets the number of video frames to record.
 *
 * @see http://libav.org/avconv.html#Video-Options
 * @param {number} frames Number of frames
 * @returns {Libav}
 */
Libav.prototype.frames = function(frames) {
	this.params.video.add('-vframes', frames);
	return this;
};

/**
 * Sets the video codec.
 *
 * See all codecs by running `avconv -codecs`.
 *
 * @param {string} codec Codec name
 * @returns {Libav}
 */
Libav.prototype.videoCodec = function(codec) {
	this.params.video.add('-vcodec', codec);
	return this;
};

/**
 * Adds a video filter.
 *
 * This is mostly used internally, but you can also use it directly
 *
 * @see http://libav.org/avconv.html#Video-Filters
 * @param {string} name Name of the filter
 * @param {string} params Filter parameters
 * @returns {Libav}
 */
Libav.prototype.videoFilter = function(name, params) {
	this.params.video.addFilter('-filter:v', name, params);
	return this;
};

/**
 * Set frame size.
 *
 * @see https://libav.org/avconv.html#Video-Options
 * @param {string|number} width Frame width
 * @param {string|number} height Frame height
 * @returns {Libav}
 */
Libav.prototype.size = function(width, height) {
	var param = '';
	if (width) {
		param += width;
	}
	if (height) {
		param += 'x' + height;
	}
	// https://libav.org/avconv.html#Video-Options
	this.params.video.add('-s', param);
	return this;
};

/**
 * Seeks the input file to a given position.
 *
 * @see https://libav.org/avconv.html#Video-Options
 * @param {string|number} position Position either in seconds or in `hh:mm:ss[.xxx]`
 * @returns {Libav}
 */
Libav.prototype.seek = function(position) {
	this.params.input.addBefore('-ss', position);
	return this;
};

/**
 * Transposes rows with columns in the input video and optionally flips it.
 *
 * Direction values are:
 *    - `0` Rotate counter clock-wise & flip
 *    - `1` Rotate clock-wise
 *    - `2` Rotate counter clock-wise
 *    - `3` Rotate clock-wise & flip
 *
 * @see https://libav.org/avconv.html#transpose
 * @param {number} direction Which direction (see above)
 * @returns {Libav}
 */
Libav.prototype.transpose = function(direction) {
	return this.videoFilter('transpose', direction);
};

/**
 * Disables audio recording.
 *
 * @see https://libav.org/avconv.html#Audio-Options
 * @returns {Libav}
 */
Libav.prototype.noAudio = function() {
	this.params.audio.add('-an');
	return this;
};

/**
 * Returns format and streams of a file.
 *
 * @param done Callback
 */
Libav.prototype.probe = function(done) {
	var cmd = 'avprobe -of json -show_streams -show_format "' + this.input + '"';
	this.logger.info('[libav] %s', cmd);
	childProcess.exec(cmd, function(err, stdout) {
		if (err) {
			return done(err);
		}
		done(null, JSON.parse(stdout));
	});
};

/**
 * Starts processing and saves result to a given file name.
 *
 * @param {string} output Path to output file
 * @param [done] Callback, called with (err)
 * @returns {Libav}
 */
Libav.prototype.save = function(output, done) {

	var that = this;
	done = done || function() {};

	this.params.output.add(
		'-loglevel', 'info',
		'-y', output
	);

	var params = _.flatten(_.map(this.params, function(param) { return param.get(); }));

	this.logger.info('[libav] avconv %s', params.join(' '));

	// Get the duplex stream
	var stream = avconv(params);

	stream.on('message', function(msg) {

		that.out += msg;

		if (~msg.indexOf(that.input + ': No such file or directory')) {
			that.error = true;
			return done('Cannot find source file "' + that.input + '"', msg);
		}
		if (~msg.indexOf(output + ': No such file or directory')) {
			that.error = true;
			return done('Cannot write to "' + output + '"', msg);
		}
		if (~msg.toLowerCase().indexOf('error')) {
			that.error = true;
			return done(msg.match(/.*error.*/i)[0], msg);
		}
		that.emit('message', msg);
	});

	stream.on('progress', function(progress) {
		that.emit('progress', Math.round(progress * 10000) / 100);
		that.logger.info('[libav] Processing at %s%', Math.round(progress * 10000) / 100);
	});

	stream.on('meta', function(meta) {
		that.emit('meta', meta);
	});

	stream.on('error', function(err) {
		if (err.code === 'ENOENT') {
			err = new Error('Cannot find binary. Are you sure that `avconv` is in your path?');
		}
		done(err);
		that.emit('error', err);
	});

	stream.on('data', function(data) {
		that.emit('data', data);
	});

	stream.once('exit', function(exitCode, signal) {
		if (!that.error) {
			done(null, that.out);
		}
		that.emit('end', exitCode, signal);
	});
};

/**
 * Parameter container
 * @param {string} name
 * @constructor
 */
function Params(name) {

	this.name = name;
	this.filters = {};
	var params = this.params = [];

	this.add = function() {
		_.each(arguments, function(arg) {
			params.push(arg);
		});
	};

	this.addBefore = function() {
		var args = _.values(arguments).reverse();
		_.each(args, function(arg) {
			params.unshift(arg);
		});
	};

	this.addFilter = function(param, name, value) {
		if (!this.filters[param]) {
			this.filters[param] = {};
		}
		this.filters[param][name] = value;
	};

	this.getFilters = function() {
		var filters = [];
		_.each(this.filters, function(filter, param) {
			filters.push(param);
			var values = _.map(filter, function(name, val) {
				return val + '=' + name;
			});
			filters.push(values.join(','));
		});
		return filters;
	};

	this.get = function() {
		return this.params.concat(this.getFilters());
	};
}

/*
 ffmpeg -formats
 ffmpeg -encoders
 ffmpeg -i b1NpFAAIZf.mp4 -y -an -vframes 1 -ss 0:0.500 b1NpFAAIZf.png
 ffmpeg -i b1NpFAAIZf.mp4 -y -an -vcodec libx264 -filter:v transpose=2,scale=w=234:h=394 b1NpFAAIZf.mp4
 ffmpeg -i b1NpFAAIZf.mp4 -y -an -vcodec libx264 b1NpFAAIZf_processing.mp4
*/