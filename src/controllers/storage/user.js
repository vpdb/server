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

var api = require('../api/api');
var auth = require('../auth');
var error = require('../../modules/error')('storage', 'user');

/**
 * Creates one or more storage tokens that can be used in an URL.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.authenticate = function(req, res) {
	if (!req.body && req.body.paths) {
		return api.fail(res, error().errors([{ message: 'You must provide the paths of the storage tokens.', path: 'paths' }]), 400);
	}
	var paths = !_.isArray(req.body.paths) ? [ req.body.paths ] : req.body.paths;
	var tokens = {};
	var now = new Date();
	paths.forEach(function(path) {
		tokens[path] = auth.generateStorageToken(req.user, now, path);
	});
	logger.info('[storage] Generated %d auth tokens for user <%s>.', _.keys(tokens).length, req.user.email);
	api.success(res, tokens);
};