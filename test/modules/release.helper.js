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

const faker = require('faker');
const FileHelper = require('./file.helper');
const GameHelper = require('./game.helper');

class ReleaseHelper {

	constructor(api) {
		/** @type {ApiClient}*/
		this.api = api;
		/** @type {FileHelper}*/
		this.fileHelper = new FileHelper(api);
		/** @type {GameHelper}*/
		this.gameHelper = new GameHelper(api);
	}

	/**
	 * Creates a release under a given game.
	 *
	 * @param user Uploader
	 * @param game Game to link to
	 * @param opts Configuration object
	 * @param {string} opts.author User name of the author
	 * @returns {Promise<Object>} Created release
	 */
	async createReleaseForGame(user, game, opts) {
		opts = opts || {};
		const vptFile = await this.fileHelper.createVpt(user, { keep: true });
		const playfield = await this.fileHelper.createPlayfield(user, 'fs', null, { keep: true });
		const res = await this.api
			.as(user)
			.markTeardown()
			.post('/v1/releases', {
				name: faker.company.catchPhraseAdjective() + ' Edition',
				license: 'by-sa',
				_game: game.id,
				versions: [{
					files: [{
						_file: vptFile.id,
						_playfield_image: playfield.id,
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}],
					version: '1.0.0'
				}],
				authors: [{ _user: this.api.getUser(opts.author || user).id, roles: ['Table Creator'] }]
			}).then(res => res.expectStatus(201));
		const release = res.data;
		release.game = game;
		return release;
	}

	/**
	 * Creates a new release and its parent game.
	 * @param user Uploader
	 * @param [opts] Configuration object
	 * @param {string} opts.author User name of the author
	 * @returns {Promise<Object>} Created release
	 */
	async createRelease(user, opts) {
		const game = await this.gameHelper.createGame('moderator');
		return this.createReleaseForGame(user, game, opts);
	}
}

module.exports = ReleaseHelper;