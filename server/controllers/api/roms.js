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

	var assert = api.assert(error, 'create', req.params.id, res);

	Game.findOne({ id: req.params.id }, assert(function(game) {
		if (!game) {
			return api.fail(res, error('No such game with ID "%s".', req.params.id), 404);
		}

		var validFields = [ 'id', 'version', 'notes', 'language', '_file' ];

		Rom.getInstance(_.extend(_.pick(req.body, validFields), {
			_game: game._id,
			_created_by: req.user._id,
			created_at: new Date()
		}), assert(function(newRom) {

			newRom.validate(function(err) {
				if (err) {
					return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
				}

				File.findById(newRom._file, assert(function(file) {

					// read zip file (also validates it's a zip)
					try {
						newRom.rom_files = [];
						new Zip(file.getPath()).getEntries().forEach(function(zipEntry) {
							if (!zipEntry.isDirectory) {
								newRom.rom_files.push({
									filename: zipEntry.name,
									bytes: zipEntry.header.size,
									crc: zipEntry.header.crc,
									modified_at: new Date(zipEntry.header.time)
								});
							}
						});
					} catch (err) {
						return api.fail(res, error('You referenced an invalid zip archive: %s', err.message).warn('create'), 422);
					}

					newRom.save(assert(function(rom) {
						logger.info('[api|rom:create] Rom "%s" successfully added.', newRom.id);

						rom.activateFiles(assert(function(rom) {
							logger.info('[api|rom:create] Referenced file activated, returning object to client.');

							LogEvent.log(req, 'upload_rom', true, { rom: rom.toSimple(), game: game.toReduced() }, { game: game._id });

							return api.success(res, rom.toSimple(), 201);

						}, 'Error activating file for game "%s"'));
					}, 'Error saving rom for game "%s" (' + newRom.id + ')'));

				}, 'Error finding file for ROM (%s).'));
			});
		}, 'Error creating rom instance for game "%s"'));
	}, 'Error retrieving game "%s"'));
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


