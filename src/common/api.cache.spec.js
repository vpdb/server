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

const resolve = require('path').resolve;

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');
const ReleaseHelper = require('../../test/modules/release.helper');

const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

describe('The VPDB API cache', () => {

	let res;
	let release;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			administrator: { roles: ['administrator'] }
		});
		release = await releaseHelper.createRelease('moderator');
	});

	afterEach(async () => await api.as('administrator').delete('/v1/cache'));
	after(async () => await api.teardown());

	describe('when listing releases', () => {

		it.only('should cache the second request', async () => {
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
		});
	});
});