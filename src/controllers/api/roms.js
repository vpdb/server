/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

const _ = require('lodash');
const logger = require('winston');
const Zip = require('adm-zip'); // todo migrate to unzip

const error = require('../../modules/error')('api', 'rom');
const acl = require('../../acl');
const api = require('./api');
const Rom = require('mongoose').model('Rom');
const Game = require('mongoose').model('Game');
const File = require('mongoose').model('File');
const LogEvent = require('mongoose').model('LogEvent');

const RomSerializer = require('../../serializers/rom.serializer');
const GameSerializer = require('../../serializers/game.serializer');

/**
 * Creates a new ROM.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	let validFields = ['id', 'version', 'notes', 'languages', '_file'];
	let newRom, game;
	return Promise.try(() => {

		if (!req.params.gameId && !req.body._ipdb_number) {
			throw error('You must provide an IPDB number when not posting to a game resource.').status(422);
		}

		// validate here because we use it in the query before running rom validations
		if (req.body._ipdb_number) {
			if (req.params.gameId) {
				throw error('Validation error').validationError('_ipdb_number', 'You must not provide an IPDB number when posting to a game resource', req.body._ipdb_number);
			}
			if (!Number.isInteger(req.body._ipdb_number) || req.body._ipdb_number < 0) {
				throw error('Validation error').validationError('_ipdb_number', 'Must be a positive integer', req.body._ipdb_number);
			}
		}

		let q = req.params.gameId ? { id: req.params.gameId } : { 'ipdb.number': req.body._ipdb_number };
		return Game.findOne(q).exec();

	}).then(g => {
		game = g;

		let rom = _.extend(_.pick(req.body, validFields), {
			_created_by: req.user._id,
			created_at: new Date()
		});

		if (game) {
			rom._game = game._id;
			rom._ipdb_number = game.ipdb.number;

		} else {
			if (req.params.gameId) {
				throw error('No such game with ID "%s"', req.params.gameId).status(404);
			}
			game = { ipdb: { number: req.body._ipdb_number }};
			rom._ipdb_number = req.body._ipdb_number;
		}
		return Rom.getInstance(rom);

	}).then(rom => {
		newRom = rom;
		return newRom.validate();

	}).then(() => {
		return File.findById(newRom._file).exec();

	}).then(file => {
		try {
			newRom.rom_files = [];
			let zip = Zip(file.getPath());
			zip.getEntries().forEach(zipEntry => {
				if (zipEntry.isDirectory) {
					return;
				}
				newRom.rom_files.push({
					filename: zipEntry.name,
					bytes: zipEntry.header.size,
					crc: zipEntry.header.crc,
					modified_at: new Date(zipEntry.header.time)
				});
			});

		} catch (err) {
			throw error('You referenced an invalid zip archive: %s', err.message).warn('create').status(422);
		}
		return newRom.save();

	}).then(rom => {

		newRom = rom;
		logger.info('[api|rom:create] Rom "%s" successfully added.', newRom.id);
		return rom.activateFiles();

	}).then(() => {

		if (game.toReduced) {
			LogEvent.log(req, 'upload_rom', true, { rom: RomSerializer.simple(newRom, req), game: GameSerializer.reduced(game, req) }, { game: game._id });
		} else {
			LogEvent.log(req, 'upload_rom', true, { rom: RomSerializer.simple(newRom, req), game: game }, { });
		}

		return api.success(res, RomSerializer.simple(newRom, req), 201);

	}).catch(api.handleError(res, error, 'Error creating ROM'));
};


/**
 * Lists all ROMs for a given game.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	let pagination = api.pagination(req, 10, 50);
	let game, ipdbNumber;

	return Promise.try(() => {

		// list roms of a game below /api/v1/games/{gameId}
		if (req.params.gameId) {
			return Game.findOne({ id: req.params.gameId });
		}

		if (req.query.game_id) {
			return Game.findOne({ id: req.query.game_id });
		}

		if (req.query.ipdb_number) {
			ipdbNumber = parseInt(req.query.ipdb_number, 10);
			if (!ipdbNumber) {
				throw error('Validation error').validationError('ipdb_number', 'Must be a whole number', req.query.ipdb_number);
			}
			return Game.findOne({ 'ipdb.number': ipdbNumber });
		}
		return null;

	}).then(g => {
		game = g;

		if (game) {
			return Rom.restrictedQuery(req, game, { _game: game._id });
		}

		// no game found.
		if (req.params.gameId) {
			throw error('No such game with ID "%s".', req.params.gameId).status(404);
		}
		if (req.query.game_id) {
			throw error('No such game with ID "%s".', req.query.game_id).status(404);
		}
		if (ipdbNumber) {
			return { _ipdb_number: ipdbNumber };
		} else {
			return Rom.handleGameQuery(req, {});
		}

	}).then(query => {

		if (!query) {
			return [ [], 0 ];
		}

		let sort = game ? { version: -1 } : { '_file.name': 1 };
		return Rom.paginate(query, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: [ '_file', '_created_by' ],
			sort: sort
		}).then(result => [ result.docs, result.total ]);

	}).spread((results, count) => {

		let roms = results.map(rom => RomSerializer.simple(rom, req));
		api.success(res, roms, 200, api.paginationOpts(pagination, count));

	}).catch(api.handleError(res, error, 'Error listing ROMs'));
};


/**
 * Returns details of a ROM
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	return Promise.try(() => {
		return Rom.findOne({ id: req.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

	}).then(rom => {
		if (!rom) {
			return api.fail(res, error('No such ROM with ID "%s".', req.params.id), 404);
		}
		return api.success(res, rom._game ? _.assign(RomSerializer.simple(rom, req), { game: GameSerializer.simple(rom._game, req) }) : RomSerializer.simple(rom, req));

	}).catch(api.handleError(res, error, 'Error viewing ROM'));
};


/**
 * Deletes a ROM.
 *
 * FIXME: promisify and check delete-own permissions
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	const assert = api.assert(error, 'delete', req.params.id, res);
	acl.isAllowed(req.user.id, 'roms', 'delete', assert(function(canDelete) {
		Rom.findOne({ id: req.params.id }, assert(function(rom) {

			if (!rom) {
				return api.fail(res, error('No such ROM with ID "%s".', req.params.id), 404);
			}

			// only allow deleting own roms
			if (!canDelete && !rom._created_by.equals(req.user._id)) {
				return api.fail(res, error('Permission denied, must be owner.'), 403);
			}

			// remove from db
			rom.remove(function(err) {
				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error deleting rom "%s"', rom.id).log('delete'), 500);
				}
				logger.info('[api|rom:delete] ROM "%s" successfully deleted.', rom.id);
				api.success(res, null, 204);
			});
		}), 'Error getting ROM "%s"');
	}, 'Error checking for ACL "roms/delete".'));
};
