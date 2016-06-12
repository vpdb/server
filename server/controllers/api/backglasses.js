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
