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

"use strict";

const _ = require('lodash');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Readable = require('stream').Readable;
const util = require('util');

/**
 * Reads the DMD capture text files and converts them into frame buffers.
 *
 * @param {String} filename Path to capture text file
 * @param {{ width: Number, height: Number, shades: Number }} opts Options
 * @constructor
 */
function DmdFrameReader(filename, opts) {
	this._started = new Date().getTime();
	let dump = fs.readFileSync(filename).toString('utf8');
	this._frames = dump.split('\r\n\r\n');
	this._hsl = rgbToHsl(0xff, 0x6a, 0x00);
	this._n = 0;

	opts = opts || {};
	this.width = opts.width || 128;
	this.height = opts.height || 32;
	this.shades = opts.shades || 16;

	console.log('Read %s frames.', this._frames.length);
}

/**
 * Copies the next frame to the frame buffer.
 *
 * @param {Buffer} buffer Frame buffer to write to
 * @returns {boolean} If true, there are still frames to read.
 */
DmdFrameReader.prototype.read = function(buffer) {

	if (this._n >= this._frames.length) {
		console.log('Done in %sms.', new Date().getTime() - this._started);
		return false;
	}
	const frameData = this._frames[this._n];
	if (!frameData) {
		this._n++;
		return true;
	}
	const lines = frameData.split('\r\n');
	for (let y = 0; y < this.height; y++) {
		for (let x = 0; x < this.width; x++) {
			try {
				let opacity = (parseInt(lines[y + 1][x], 16) + 1) / this.shades;
				let idx = (this.width * y + x) * 3;
				let rgb = hslToRgb(this._hsl[0], this._hsl[1], opacity * this._hsl[2]);
				buffer[idx] = rgb[0];
				buffer[idx + 1] = rgb[1];
				buffer[idx + 2] = rgb[2];

			} catch (err) {
				console.error('Error parsing DMD data: %s', err.message);
				console.error(err.stack);
				console.log(frameData);
				return false;
			}
		}
	}
	this._n++;
	return true;
};

/**
 * A readable stream that returns RGB24 frames.
 *
 * @param generator Generator class that produces frames
 * @param {{ width: Number, height: Number }} opts Options
 * @constructor
 */
function RawImageStream(generator, opts) {
	// init Readable
	Readable.call(this, opts);
	opts = opts || {};

	if (!_.isFunction(generator.read)) {
		throw new Error('Generator must contain a read() function!');
	}

	this._generator = generator;
	this.width = opts.width || 128;
	this.height = opts.height || 32;
}
util.inherits(RawImageStream, Readable);
RawImageStream.prototype._read = function() {
	let rawImage = new Buffer(this.width * this.height * 3);
	if (this._generator.read(rawImage)) {
		this.push(rawImage);
		return true;
	}
	console.error('done!');
	this.push(null);
	return false;
};

const opts = {
	width: 128,
	height: 32,
	shades: 16
};

//  ffmpeg -y -f rawvideo -s 128x32 -pix_fmt rgb24 -i - -vcodec libx264 -f mp4 frames.mp4

const dmdRawFrameStream = new RawImageStream(new DmdFrameReader('avg_170_dump.txt', opts), opts);
const spawn = require('child_process').spawn;
const ps = spawn('ffmpeg', [
	'-y', '-f', 'rawvideo', '-s', '128x32', '-pix_fmt', 'rgb24', '-i', '-',
	'-vcodec', 'libx264', '-f', 'mp4', '-b', '100k', 'frames.mp4']);

ps.stdout.on('data', data => console.log(data.toString()));
ps.stderr.on('data', data => console.log(data.toString()));
ps.on('close', code => console.log(`done! (${code})`));
dmdRawFrameStream.pipe(ps.stdin);


/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l) {
	var r, g, b;

	if (s == 0) {
		r = g = b = l; // achromatic
	} else {
		var hue2rgb = function hue2rgb(p, q, t) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return [h, s, l];
}