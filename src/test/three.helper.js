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

// require('babel-register')({presets: [ 'env' ]});
//
// const { parse } = require('url');
//
// const {GLBLoader, smartFetch} = require('loaders.gl');

const { parse } = require('url');
const axios = require('axios');
const THREE = global.THREE = require('three');
global.TextDecoder = require('util').TextDecoder;

require('three/examples/js/loaders/GLTFLoader');

class ThreeHelper {

	/**
	 * @param {ApiClient} apiClient
	 */
	constructor(apiClient) {
		this.api = apiClient;
		this.loader = new THREE.GLTFLoader();
	}

	async loadGlb(user, link) {
		let token = '';
		if (link.is_protected) {
			const urlParts = parse(link.url);
			const res = await this.api.as(user)
				.on('storage')
				.post('/v1/authenticate', { paths: urlParts.pathname })
				.then(res => res.expectStatus(200));
			token = '?token=' + res.data[urlParts.pathname];
		}
		const response = await axios.get(link.url + token, { responseType: 'arraybuffer' });
		return new Promise((resolve, reject) => {
			this.loader.parse(this.toArrayBuffer(response.data), '', resolve, reject);
		});
	}

	toArrayBuffer(buf) {
		const ab = new ArrayBuffer(buf.length);
		const view = new Uint8Array(ab);
		for (let i = 0; i < buf.length; ++i) {
			view[i] = buf[i];
		}
		return ab;
	}
}

module.exports = ThreeHelper;