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
/* global describe, before, after, it */

const expect = require('expect.js');

const ApiClient = require('../../test/modules/api.client');
const ReleaseHelper = require('../../test/modules/release.helper');
const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

let res;
describe('The VPDB `Release` storage API', () => {

	describe('when downloading a release', () => {

		before(async () => {
			await api.setupUsers({
				countertest: { roles: ['member'] },
				moderator: { roles: ['moderator'] },
				contributor: { roles: ['contributor'] }
			});
		});

		after(async () => await api.teardown());

		it('should update all the necessary download counters.', async () => {

			const release = await releaseHelper.createRelease('contributor');
			const url = '/storage/v1/releases/' + release.id;
			const body = {
				files: [release.versions[0].files[0].file.id],
				media: {
					playfield_image: false,
					playfield_video: false
				},
				game_media: false
			};
			const token = await api.retrieveStorageToken('countertest', url);
			await api
				.withQuery(({ token: token, body: JSON.stringify(body) }))
				.debug()
				.getAbsolute(url)
				.then(res => res.expectStatus(200));

			// game downloads
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);

			// release / file downloads
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);
			expect(res.data.versions[0].counter.downloads).to.be(1);
			expect(res.data.versions[0].files[0].counter.downloads).to.be(1);
			expect(res.data.versions[0].files[0].file.counter.downloads).to.be(1);

			// check user counter
			res = await api.as('countertest').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);
		});
	});

});