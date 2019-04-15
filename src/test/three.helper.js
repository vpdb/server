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

const { parse } = require('url');
const { createHash } = require('crypto');
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
			this.loader.parse(toArrayBuffer(response.data), '', resolve, reject);
		});
	}

	first(gltf, groupName) {
		const table = this.getTable(gltf);
		if (!table.children || !table.children.length) {
			throw new Error('GLTF table has no children!');
		}
		const objects = table.children.find(c => c.name === groupName);
		if (!objects) {
			throw new Error('GLTF table has no "' + groupName + '" group!');
		}
		if (!objects.children || !objects.children.length) {
			throw new Error('The "' + groupName + '" group of the GLTF table has no children.');
		}
		return objects.children[0];
	}

	find(gltf, groupName, objectName) {
		const table = this.getTable(gltf);
		if (!table.children || !table.children.length) {
			throw new Error('GLTF table has no children!');
		}
		const objects = table.children.find(c => c.name === groupName);
		if (!objects) {
			throw new Error('GLTF table has no "' + groupName + '" group!');
		}
		if (!objects.children || !objects.children.length) {
			throw new Error('The "' + groupName + '" group of the GLTF table has no children.');
		}
		const object = objects.children.find(c => c.name === objectName);
		if (!object) {
			throw new Error('The "' + groupName + '" group of the GLTF table has no child named "' + objectName + '" ([' + objects.children.map(c => c.name).join(', ') + '])');
		}
		return object;
	}

	getTable(gltf) {
		if (!gltf || !gltf.scene || !gltf.scene.children || !gltf.scene.children.length) {
			throw new Error('Cannot find scene in GLTF.');
		}
		const table = gltf.scene.children.find(c => c.name === 'playfield');
		if (!table) {
			throw new Error('Cannot find table in GLTF.');
		}
		return table;
	}

	expectVerticesInArray(vertices, array) {
		// create hash map of vertices
		let vertexHashes = {};
		for (let i = 0; i < array.length; i +=3) {
			vertexHashes[this.hashVertex(array.slice(i, i + 3))] = true;
		}
		for (const expectedVertex of vertices) {
			const vertexHash = this.hashVertex(expectedVertex);
			if (!vertexHashes[vertexHash]) {
				throw new Error('Vertex { ' + expectedVertex.join(', ') + ' } not found in array (' + array.join(', ') + ').');
			}
		}
	}

	hashVertex(vertex) {
		const trim = 1000;
		return `${Math.floor(vertex[0] * trim)},${Math.floor(vertex[1] * trim)},${Math.floor(vertex[2] * trim)}`;
	}

	vertexEquals(v1, v2) {
		for (let i = 0; i < 3; i++) {
			if (Math.floor(v1[i] * 1000) !== Math.floor(v2[i] * 1000)) {
				return false;
			}
		}
		return true;
	}

}

function toArrayBuffer(buf) {
	const ab = new ArrayBuffer(buf.length);
	const view = new Uint8Array(ab);
	for (let i = 0; i < buf.length; ++i) {
		view[i] = buf[i];
	}
	return ab;
}

module.exports = ThreeHelper;