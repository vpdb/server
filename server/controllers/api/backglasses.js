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

const _ = require('lodash');
const logger = require('winston');

const acl = require('../../acl');
const api = require('./api');
const File = require('mongoose').model('File');
const Rom = require('mongoose').model('Rom');
const Backglass = require('mongoose').model('Backglass');

const error = require('../../modules/error')('api', 'backglass');

/**
 * Creates a new backglass.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	const now = new Date();
	let backglass;
	let backglassFile;
	Promise.try(function() {

		return Backglass.getInstance(_.extend(req.body, {
			_created_by: req.user._id,
			created_at: now
		}));

	}).then(newBackglass => {

		backglass = newBackglass;
		if (_.isArray(backglass.versions)) {
			backglass.versions.forEach(version => {
				if (!version.released_at) {
					version.released_at = now;
				}
			});
			if (backglass.versions[0] && !backglass._game) {
				return File.findById(backglass.versions[0]._file).exec();
			}
		}

	}).then(file => {
		if (file && file.metadata && file.metadata.gamename) {
			backglassFile = file;
			return Rom.findOne({ id: file.metadata.gamename }).exec();
		}

	}).then(rom => {
		if (rom) {
			logger.info('[ctrl|backglass] Linking backglass to same game %s as rom "%s".', rom._game, backglassFile.metadata.gamename);
			backglass._game = rom._game;
		}
		return backglass.validate();

	}).then(() => {
		return backglass.save();

	}).then(() => {

		return Backglass.findById(backglass._id)
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions._file' })
			.exec();

	}).then(populatedBackglass => {

		logger.info('[api|build:create] Backglass "%s" successfully created.', backglass.label);
		api.success(res, populatedBackglass.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating backglass'));
};

/**
 * Deletes a backglass.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	let backglass;
	let canDelete;
	Promise.try(() => {
		return acl.isAllowed(req.user.id, 'backglasses', 'delete');

	}).then(result => {
		canDelete = result;
		return Backglass.findOne({ id: req.params.id }).exec();

	}).then(result => {

		backglass = result;
		if (!backglass) {
			throw error('No such backglass with ID "%s".', req.params.id).status(404);
		}

		// only allow deleting own roms
		if (!canDelete && !backglass._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}
		// remove from db
		return backglass.remove();

	}).then(() => {
		logger.info('[api|rom:delete] ROM "%s" successfully deleted.', backglass.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting backglass'));
};
