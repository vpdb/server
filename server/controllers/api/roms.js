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

"use strict";

var _ = require('lodash');
var logger = require('winston');
var Zip = require('adm-zip'); // todo migrate to unzip

var error = require('../../modules/error')('api', 'rom');
var acl = require('../../acl');
var api = require('./api');
var Rom = require('mongoose').model('Rom');
var Game = require('mongoose').model('Game');
var File = require('mongoose').model('File');
var LogEvent = require('mongoose').model('LogEvent');

/**
 * Creates a new ROM.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	var newRom, game;
	Promise.try(() => {

		if (!req.params.id && !req.body._ipdb_number) {
			throw error('You must provide an IPDB number when not posting to a game resource.', req.params.id).status(400);
		}

		var validFields = [ 'id', 'version', 'notes', 'language', '_file' ];
		if (req.params.id) {
			return Game.findOne({ id: req.params.id }).exec().then(g => {
				game = g;
				if (!game) {
					throw error('No such game with ID "%s".', req.params.id).status(404);
				}
				return Rom.getInstance(_.extend(_.pick(req.body, validFields), {
					_game: game._id,
					_created_by: req.user._id,
					created_at: new Date()
				}));
			});
		}
		game = { ipdb: { number: req.body._ipdb_number }};
		return Rom.getInstance(_.extend(_.pick(req.body, validFields), {
			_ipdb_number: req.body._ipdb_number,
			_created_by: req.user._id,
			created_at: new Date()
		}));

	}).then(rom => {
		newRom = rom;
		return newRom.validate();

	}).then(() => {
		return File.findById(newRom._file).exec();

	}).then(file => {
		try {
			newRom.rom_files = [];
			new Zip(file.getPath()).getEntries().forEach(zipEntry => {
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

		// check if there's a game to link
		if (newRom._ipdb_number) {
			return Game.findOne({ 'ipdb.number': newRom._ipdb_number }).exec().then(game => {
				if (game) {
					logger.info('[api|rom:create] Found existing game "%s" for IPDB number %s, linking.', game.id, newRom._ipdb_number);
					newRom._game = game._id.toString();
					return newRom.save();
				}
			});
		}

	}).then(() => {

		if (game.toReduced) {
			LogEvent.log(req, 'upload_rom', true, { rom: newRom.toSimple(), game: game.toReduced() }, { game: game._id });
		} else {
			LogEvent.log(req, 'upload_rom', true, { rom: newRom.toSimple(), game: game }, { });
		}

		api.success(res, newRom.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating ROM'));
};


/**
 * Lists all ROMs for a given game.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var assert = api.assert(error, 'list', '', res);
	var pagination = api.pagination(req, 10, 50);

	Game.findOne({ id: req.params.id }, assert(function(game) {
		if (!game) {
			return api.fail(res, error('No such game with ID "%s".', req.params.id), 404);
		}
		Rom.paginate({ '_game': game._id }, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: [ '_file', '_created_by' ],
			sort: { version: -1 }

		}, function(err, result) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error listing roms').log('list'), 500);
			}
			var roms = _.map(result.docs, function(rom) {
				return rom.toSimple();
			});
			api.success(res, roms, 200, api.paginationOpts(pagination, result.total));

		});

	}, 'Error finding release in order to list comments.'));
};


/**
 * Deletes a ROM.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var assert = api.assert(error, 'delete', req.params.id, res);
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


