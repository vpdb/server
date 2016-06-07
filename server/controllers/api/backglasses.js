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
	let newBackglass;
	Promise.try(function() {

		return Backglass.getInstance(_.extend(req.body, {
			_created_by: req.user._id,
			created_at: now
		}));

	}).then(bg => {

		newBackglass = bg;
		if (newBackglass.versions) {
			newBackglass.versions.forEach(version => {
				if (!version.released_at) {
					version.released_at = now;
				}
			});
		}

		return newBackglass.validate();

	}).then(function() {
		return newBackglass.save();

	}).then(function() {
		logger.info('[api|build:create] Backglass "%s" successfully created.', newBackglass.label);
		api.success(res, newBackglass.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating backglass'));
};
