/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var error = require('../../modules/error')('api', 'token');
var acl = require('../../acl');
var api = require('./api');
var Token = require('mongoose').model('Token');

exports.create = function(req, res) {

	var newToken = new Token(_.extend(req.body, {
		is_active: true,
		created_at: new Date(),
		expires_at: new Date(new Date().getTime() + 31536000000),
		_created_by: req.user._id
	}));

	newToken.validate(function(err) {
		if (err) {
			return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
		}
		newToken.save(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error saving token "%s"', newToken.label).log('create'), 500);
			}
			logger.info('[api|token:create] Token "%s" successfully created.', newToken.label);
			return api.success(res, newToken.toSimple(true), 201);
		});
	});
};
