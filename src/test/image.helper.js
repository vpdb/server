/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

const pleasejs = require('pleasejs');
const sharp = require('sharp');

class ImageHelper {

	/**
	 * Creates a PNG for a given resolution and a random color
	 * @param {number} width Width in pixels
	 * @param {number} height Height in pixels
	 * @returns {Promise<Buffer>} Image as buffer
	 */
	async createPng(width, height) {
		return sharp({
			create: {
				width: width,
				height: height,
				channels: 3,
				background: pleasejs.make_color({ format: 'rgb' })
			}
		})
		.png()
		.toBuffer()
	}

	/**
	 * Returns metadata of the image.
	 * @param {{ data: Buffer }} res Response object (containing image in `data`) - use `.responseAs('arraybuffer')` in client.
	 * @returns {Promise<sharp.Metadata>}
	 */
	async metadata(res) {
		return sharp(res.data).metadata();
	}
}

module.exports = ImageHelper;
