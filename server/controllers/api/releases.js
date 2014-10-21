/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var util = require('util');
var logger = require('winston');

var Release = require('mongoose').model('Release');
var api = require('./api');

var error = require('../../modules/error')('api', 'release');


/**
 * Creates a new release.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	Release.getInstance(_.extend(req.body, {
		_created_by: req.user._id,
		created_at: new Date()
	}), function(err, newRelease) {
		if (err) {
			return api.fail(res, error(err, 'Error creating release instance').log('create'), 500);
		}
		var assert = api.assert(error, 'create', newRelease.id, res);
		var assertRb = api.assert(error, 'create', newRelease.id, res, function(done) {
			newRelease.remove(done);
		});
		logger.info('[api|release:create] %s', util.inspect(req.body));
		newRelease.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed: %j', err.errors).errors(err.errors).warn('create'), 422);
			}
			logger.info('[api|release:create] Validations passed.');
			newRelease.save(assert(function(release) {
				logger.info('[api|release:create] Release "%s" created.', release.name);

				// set media to active
				release.activateFiles(assertRb(function(release) {
					logger.info('[api|release:create] All referenced files activated, returning object to client.');
					return api.success(res, release.toDetailed(), 201);

				}, 'Error activating files for release "%s"'));
			}, 'Error saving release with id "%s"'));
		});
	});
};
