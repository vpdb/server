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
const statSync = require('fs').statSync;
const expect = require('expect.js');

const shortId = require('shortid32');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');
const GameHelper = require('../../test/modules/game.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);
const gameHelper = new GameHelper(api);

let res;

describe.skip('The VPDB `game` API', () => {

	describe('when posting a new game', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			});
		});

		after(async () => await api.teardown());

		it('should succeed if provided data is correct', async () => {

			const backglass = await fileHelper.createBackglass('member');
			await api
				.as('moderator')
				.markTeardown()
				.save('games/create')
				.post('/v1/games', gameHelper.getGame({ _backglass: backglass.id }))
				.then(res => res.expectStatus(201));
		});

	});

});