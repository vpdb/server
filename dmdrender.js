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

const fs = require('fs');
const gm = require('gm');
const PNG = require('pngjs').PNG;
const ffmpeg = require('fluent-ffmpeg');
const PassThrough = require('stream').PassThrough;
const Promise = require('bluebird');

const width = 128;
const height = 32;
const shades = 16;

let dump = fs.readFileSync('avg_170_dump.txt').toString('utf8');
let frames = dump.split('\r\n\r\n');
console.log('Read %s frames.', frames.length);
let hsl = rgbToHsl(0xff, 0x6a, 0x00);
let n = 0;
let jpgStream = new PassThrough();
ffmpeg()
	.input(jpgStream)
	.inputFormat('image2pipe')
	.inputOptions('-vcodec mjpeg')
	.fps(30)
	.format('mp4')
	.outputOptions('-movflags frag_keyframe+empty_moov')
	.videoCodec('libx264')
	//	.videoBitrate(1000, true)
	.output(fs.createWriteStream('frames.mp4'), { end: false })
	.on('start', function(commandLine) {
		console.log('Spawned Ffmpeg with command: ' + commandLine);
		Promise.each(frames, frameData => {
			return new Promise((resolve, reject) => {
				let lines = frameData.split('\r\n');
				let frame = new PNG({ width: width, height: height, bgColor: { red: 0, green: 0, blue: 0 } });
				console.log('%s %s', n, lines[0]);
				if (!frameData) {
					return resolve();
				}
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						try {
							let opacity = (parseInt(lines[y + 1][x], 16) + 1) / shades;
							let idx = (width * y + x) << 2;
							let rgb = hslToRgb(hsl[0], hsl[1], opacity * hsl[2]);
							frame.data[idx] = rgb[0];
							frame.data[idx + 1] = rgb[1];
							frame.data[idx + 2] = rgb[2];
							frame.data[idx + 3] = 255;

						} catch (err) {
							console.error('Error parsing DMD data: %s', err.message);
							console.log(frameData);
							return resolve();
						}
					}
				}
				frame.on('error', reject);
				frame.on('end', resolve);
				//frame.pack().pipe(fs.createWriteStream('frame_' + n + '.png'));
				//gm(frame.pack()).setFormat('jpg').quality(100).stream().pipe(fs.createWriteStream('frame_' + n + '.jpg'));
				gm(frame.pack()).setFormat('jpg').quality(100).stream().on('data', data => {
					jpgStream.push(data);
				});
				//frame.pack().on('data', data => { pngStream.push(data); });
				n++;
			});
		}).then(() => {
			//pngStream.push(null);
			jpgStream.emit('end');
			console.log('%s Frames sent to ffmpeg.', n);
		});
	})
	.on('codecData', data => {
		console.log('CODEC DATA:');
		console.log(data);
	})
	.on('progress', progress => {
		console.log('PROGRESS:');
		console.log(progress);
	})
	.on('stderr', stderr => {
		console.log(stderr);
	})
	.on('error', err => {
		console.log('Error rendering: %s', err.message);
	})
	.on('end', () => {
		console.log('Video saved!');
	})
	.run();


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