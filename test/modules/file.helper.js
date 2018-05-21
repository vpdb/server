/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

const gm = require('gm');
const pleasejs = require('pleasejs');

require('bluebird').promisifyAll(gm.prototype);

class FileHelper {

	constructor(api, storage) {
		this.api = api;
		this.storage = storage;
	}

	async createPlayfield(user, orientation, type) {
		const playfields = await this.createPlayfields(user, orientation, 1, type);
		return playfields[0];
	};

	async createPlayfields(user, orientation, times, type) {

		const fileType = type || 'playfield-' + orientation;
		const mimeType = 'image/png';

		const isFS = orientation === 'fs';
		const results = [];

		for (let i = 0; i < times; i++) {
			const name = 'playfield-' + i + '.png';

			const img = gm(isFS ? 1080 : 1920, isFS ? 1920 : 1080, pleasejs.make_color());
			const data = await img.toBufferAsync('PNG');
			const res = await this.storage
				.debug()
				.as(user)
				.markTeardown()
				.withQuery({ type: fileType })
				.withContentType(mimeType)
				.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectStatus(201));

			results.push(res.data);
		}
		return results;
	}
}

module.exports = FileHelper;