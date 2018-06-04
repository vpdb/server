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

'use strict';
/*global describe, before, after, it*/

const shortId = require('shortid32');
shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

let res;

describe('The VPDB `file` storage API', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: [ 'member' ]},
			moderator: { roles: [ 'moderator' ]},
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ]}
		});
	});

	after(async () => await api.teardown());

	describe('when providing cache information', () => {

		it('should return a "Last-Modified" header for all storage items.', async () => {
			const backglass = await fileHelper.createBackglass('member');
			const token = await api.retrieveStorageToken('member', backglass.url);
			await api.onStorage()
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(200).expectHeader('last-modified'));
		});

		it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', async () => {
			const backglass = await fileHelper.createBackglass('member');
			const token = await api.retrieveStorageToken('member', backglass.url);
			res = await api.onStorage()
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(200));

			const lastModified = res.response.headers['last-modified'];
			await api.onStorage()
				.withQuery({ token: token })
				.withHeader('If-Modified-Since', lastModified)
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(304));
		});
	});
});