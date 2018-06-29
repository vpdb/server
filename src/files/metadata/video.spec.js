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

const expect = require('expect.js');

const ApiClient = require('../../../test/modules/api.client');
const FileHelper = require('../../../test/modules/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

describe('The VPDB `file` API for videos', () => {

	before(async () => {
		await api.setupUsers({ moderator: { roles: ['moderator'] } });
	});

	after(async () => await api.teardown());

	describe('when uploading a video', () => {

		it('should return the correct dimensions', async () => {
			const video = await fileHelper.createMp4('moderator');
			expect(video.metadata.video.width).to.be(1920);
			expect(video.metadata.video.height).to.be(1080);
		});

	});

});