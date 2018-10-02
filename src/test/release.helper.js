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

const { isObject } = require('lodash');
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
	 * @param [opts] Configuration object
	 * @param {string|object} [opts.author] User name of the author
	 * @param {string[]} [opts.builds] Array of builds to override
	 * @param {string[]} [opts.tags] Array of tags to override
	 * @param {object[]} [opts.files] Additional version files
	 * @param {object} [opts.file] Extend version file with this data
	 * @param {object} [opts.release] Extend release with this data
	 * @returns {Promise<Object>} Created release
	 */
	async createReleaseForGame(user, game, opts) {
		opts = opts || {};
		const vptFile = await this.fileHelper.createVpt(user, Object.assign({ keep: true }, opts));
		const playfield = await this.fileHelper.createPlayfield(user, 'fs', null, { keep: true });
		const additionalFiles = opts.files || [];
		const author = isObject(opts.author) ? opts.author : this.api.getUser(opts.author || user);
		const res = await this.api
			.as(user)
			.markTeardown()
			.post('/v1/releases', Object.assign({
				name: faker.company.catchPhraseAdjective() + ' Edition',
				license: 'by-sa',
				_game: game.id,
				_tags: opts.tags || [ 'hd' ],
				versions: [{
					files: [ Object.assign({
						_file: vptFile.id,
						_playfield_images: [ playfield.id ],
						_compatibility: opts.builds || ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}, opts.file || {}), ...additionalFiles],
					version: '1.0.0'
				}],
				authors: [{ _user: author.id, roles: ['Table Creator'] }]
			}, opts.release || {})).then(res => res.expectStatus(201));
		const release = res.data;
		release.game = game;
		return release;
	}

	/**
	 * Creates a new release and its parent game.
	 * @param user Uploader
	 * @param [opts] Configuration object
	 * @param {string|object} [opts.author] User name of the author
	 * @param {string[]} [opts.builds] Array of builds to override
	 * @param {string[]} [opts.tags] Array of tags to override
	 * @param {object[]} [opts.files] Additional version files
	 * @param {object} [opts.file] Extend version file with this data
	 * @param {object} [opts.release] Extend release with this data
	 * @param {boolean} [opts.alternateVpt] If set, upload an alternative file
	 * @returns {Promise<Object>} Created release
	 */
	async createRelease(user, opts) {
		const game = await this.gameHelper.createGame('moderator');
		return this.createReleaseForGame(user, game, opts);
	}

	/**
	 * Creates a DirectB2s backglass release.
	 *
	 * @param user Uploader
	 * @param {object} [opts] Configuration object
	 * @param {object} [opts.game] Use provided game object instead of creating a new one
	 * @param {string} [opts.author] User name of the author
	 * @returns {Promise<Object>} Created DirectB2S
	 */
	async createDirectB2S(user, opts) {
		opts = opts || {};
		const game = opts.game || (await this.gameHelper.createGame('moderator'));
		const bgFile = await this.fileHelper.createDirectB2S(user, { keep: true });
		const res = await this.api
			.as(user)
			.markTeardown()
			.post('/v1/backglasses', {
				_game: game.id,
				description: faker.company.catchPhrase(),
				authors: [{ _user: this.api.getUser(opts.author || user).id, roles: ['Table Creator'] }],
				versions: [{
					version: '1.0',
					changes: faker.company.catchPhrase(),
					_file: bgFile.id
				}]
			}).then(res => res.expectStatus(201));
		const bg = res.data;
		bg.game = game;
		return bg;
	}
}

module.exports = ReleaseHelper;