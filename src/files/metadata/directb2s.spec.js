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

const ApiClient = require('../../../test/modules/api.client');

const api = new ApiClient();

describe('The VPDB `file` API', () => {

	before(async () => {
		await api.setupUsers({ member: { roles: ['member'] } });
	});

	after(async () => await api.teardown());

	describe('when uploading a directb2s file', () => {

		it.skip('should return the correct variations', async () => {
			throw new Error();
		});

		it('should fail if the directb2s file is corrupted', async () => {
			const data = 'invalid data';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'backglass' })
				.withContentType('application/x-directb2s')
				.withHeader('Content-Disposition', 'attachment; filename="test.directb2s"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});

	});

});