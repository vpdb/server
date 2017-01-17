/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2017 freezy <freezy@xbmc.org>
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

const Stream = require('stream');
const HSL = rgbToHsl(0xff, 0x6a, 0x00);

class DmdStream {

	constructor() {
		this._streams = [];
	}

	getStream() {
		return this._streams.length > 0 ? this._streams[0] : null;
	}

	stream(writeStream) {
		let stream = this.getStream();
		if (stream === null) {
			return false;
		}
		const spawn = require('child_process').spawn;
		const ffmpeg = spawn('ffmpeg', [
			'-y', '-f', 'rawvideo', '-s', '128x32', '-pix_fmt', 'rgb24', '-re', '-i', 'pipe:0',
			'-codec:v', 'libx264', '-f', 'mp4', '-b:v', '100k', '-pix_fmt', 'yuv444p', 'pipe:1']);
		//ffmpeg.stdout.on('data', data => console.log(data.toString()));
		ffmpeg.stderr.on('data', data => console.log(data.toString()));
		ffmpeg.stdout.pipe(writeStream);
		stream.pipe(ffmpeg.stdin);
		return true;
	}

	onNewConnection(socket) {

		//console.log('got new socket: ', socket);
		const stream = new Stream();
		stream.readable = true;

		socket.on('gray2frame', data => {
			let rgbFrame = new Buffer(128 * 32 * 3);
			let pos = 0;
			for (let y = 0; y < 32; y++) {
				for (let x = 0; x < 128; x++) {
					let opacity = data[y * 128 + x] / 4;
					let rgb = hslToRgb(HSL[0], HSL[1], opacity * HSL[2]);
					rgbFrame[pos] = rgb[0];
					rgbFrame[pos + 1] = rgb[1];
					rgbFrame[pos + 2] = rgb[2];
					pos += 3;
				}
			}
			stream.emit('data', rgbFrame);
		});
		socket.on('end', function() {
			console.log('Closing stream.');
			stream.emit('end');
		});

		this._streams.push(stream);
	}
}
module.exports = new DmdStream();


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
	let r, g, b;

	if (s === 0) {
		r = g = b = l; // achromatic
	} else {
		const hue2rgb = function hue2rgb(p, q, t) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
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
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h, s, l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
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