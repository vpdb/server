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
	 * @param {string} [opts.version] If set, version
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
						_playfield_image: playfield.id,
						_compatibility: opts.builds || ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}, opts.file || {}), ...additionalFiles],
					version: opts.version || '1.0.0',
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
	 * @param {string} [opts.version] If set, set version
	 * @returns {Promise<Object>} Created release
	 */
	async createRelease(user, opts) {
		const game = await this.gameHelper.createGame('moderator');
		return this.createReleaseForGame(user, game, opts);
	}

	/**
	 * Creates a number of new release with a new game each
	 * @param user Uploader
	 * @param {number} times Number of releases to create
	 * @param [opts] Configuration object
	 * @param {string|object} [opts.author] User name of the author
	 * @param {string[]} [opts.builds] Array of builds to override
	 * @param {string[]} [opts.tags] Array of tags to override
	 * @param {object[]} [opts.files] Additional version files
	 * @param {object} [opts.file] Extend version file with this data
	 * @param {object} [opts.release] Extend release with this data
	 * @param {boolean} [opts.alternateVpt] If set, upload an alternative file
	 * @param {string} [opts.version] If set, set version
	 * @returns {Promise<Object[]>} Created releases
	 */
	async createReleases(user, times, opts) {
		const releases = [];
		for (let i = 0; i < times; i++) {
			switch (i) {
				case 1: releases.push(await this.createRelease2(user)); break;
				case 2: releases.push(await this.createRelease3(user)); break;
				case 3: releases.push(await this.createRelease4(user)); break;
				default: releases.push(await this.createRelease(user, opts)); break;
			}
		}
		return releases;
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

	async createRelease2(user) {
		const game = await this.gameHelper.createGame('moderator');
		const vptfiles = await this.fileHelper.createVpts(user, 2, { keep: true });
		const playfieldFs = await this.fileHelper.createPlayfield(user, 'fs', undefined, { keep: true });
		const playfieldWs = await this.fileHelper.createPlayfield(user, 'ws', undefined, { keep: true });
		const res = await this.api.as(user)
			.markTeardown()
			.post('/v1/releases', {
				name: faker.company.catchPhraseAdjective() + ' Edition',
				license: 'by-sa',
				_game: game.id,
				versions: [
					{
						files: [{
							_file: vptfiles[0].id,
							_playfield_image: playfieldFs.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'fs', lighting: 'night' }
						}, {
							_file: vptfiles[1].id,
							_playfield_image: playfieldWs.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'ws', lighting: 'day' }
						}],
						version: '1.0'
					}
				],
				_tags: ['dof'],
				authors: [{_user: this.api.getUser(user).id, roles: ['Table Creator']}]
			})
			.then(res => res.expectStatus(201));
		const release = res.data;
		release.game = game;
		return release;
	}

	async createRelease3(user) {
		const game = await this.gameHelper.createGame('moderator');
		const vptfiles = await this.fileHelper.createVpts(user, 3, { keep: true });
		const playfields = await this.fileHelper.createPlayfields(user, 'fs', 3, undefined, { keep: true });
		const res = await this.api.as(user)
			.markTeardown()
			.post('/v1/releases', {
				name: faker.company.catchPhraseAdjective() + ' Edition',
				license: 'by-sa',
				_game: game.id,
				versions: [
					{
						files: [ {
							_file: vptfiles[0].id,
							_playfield_image: playfields[0].id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'fs', lighting: 'any' }
						}, {
							_file: vptfiles[1].id,
							_playfield_image: playfields[1].id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'any', lighting: 'night' }
						}, {
							_file: vptfiles[2].id,
							_playfield_image: playfields[2].id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'any', lighting: 'any' }
						} ],
						version: '2.0'
					}
				],
				_tags: ['wip', 'dof'],
				authors: [ { _user: this.api.getUser(user).id, roles: [ 'Table Creator' ] } ]
			})
			.then(res => res.expectStatus(201));
		const release = res.data;
		release.game = game;
		return release;
	}

	async createRelease4(user) {
		const game = await this.gameHelper.createGame('moderator');
		const vptfiles = await this.fileHelper.createVpts(user, 3, { keep: true });
		const playfields = await this.fileHelper.createPlayfields(user, 'fs', 2, undefined, { keep: true });
		const playfieldWs = await this.fileHelper.createPlayfield(user, 'ws', undefined, { keep: true });
		const res = await this.api.as(user)
			.markTeardown()
			.post('/v1/releases', {
				name: faker.company.catchPhraseAdjective() + ' Edition',
				license: 'by-sa',
				_game: game.id,
				versions: [
					{
						files: [ {
							_file: vptfiles[0].id,
							_playfield_image: playfields[0].id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'fs', lighting: 'night' }
						}, {
							_file: vptfiles[1].id,
							_playfield_image: playfields[1].id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'fs', lighting: 'day' }
						} ],
						version: '2.0',
						"released_at": "2015-08-30T12:00:00.000Z"
					}, {

						files: [ {
							_file: vptfiles[2].id,
							_playfield_image: playfieldWs.id,
							_compatibility: [ '10.x' ],
							flavor: { orientation: 'ws', lighting: 'night' }
						} ],
						version: '1.0',
						"released_at": "2015-07-01T12:00:00.000Z"
					}
				],
				_tags: ['wip', 'dof'],
				authors: [ { _user: this.api.getUser(user).id, roles: [ 'Table Creator' ] } ]
			})
			.then(res => res.expectStatus(201));
		const release = res.data;
		release.game = game;
		return release;
	}
}

module.exports = ReleaseHelper;
