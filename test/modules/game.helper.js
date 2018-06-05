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

const resolve = require('path').resolve;
const randomString = require('randomstring');
const assign = require('lodash').assign;
const extend = require('lodash').extend;
const FileHelper = require('./file.helper');

const ipdb = require(resolve(__dirname, '../../data/ipdb.json'));

class GameHelper {

	constructor(api) {
		/** @type {ApiClient}*/
		this.api = api;
		/** @type {FileHelper}*/
		this.fileHelper = new FileHelper(api);
	}

	/**
	 * Creates a new game. Automatically marks game for deletion after test.
	 *
	 * @param user
	 * @param game
	 * @return {Promise<Object>}
	 */
	async createGame(user, game) {
		const backglass = await this.fileHelper.createBackglass(user);
		const res = await this.api
			.as(user)
			.markTeardown()
			.post('/v1/games', assign(this.getGame({ _backglass: backglass.id }), game))
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createGames(user, count) {
		const games = [];
		for (let i = 0; i < count; i++) {
			games.push(await this.createGame(user));
		}
		return games;
	}

	getGame(attrs, ipdbNumber) {
		const game = this._popGame(ipdbNumber);
		if (game.short) {
			game.id = game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
		} else {
			game.id = /unknown/i.test(game.title) ? randomString.generate(7) : game.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
		}
		game.year = game.year || 1900;
		game.game_type = game.game_type || 'na';
		game.manufacturer = game.manufacturer || 'unknown';
		return attrs ? extend(game, attrs) : game;
	}

	_popGame(ipdbNumber) {
		if (ipdbNumber) {
			return ipdb.find(i => i.ipdb.number === parseInt(ipdbNumber));
		}
		return ipdb.splice(this._randomInt(ipdb.length), 1)[0];
	}

	_randomInt(max) {
		return Math.floor(Math.random() * max - 1) + 1;
	}
}

module.exports = GameHelper;