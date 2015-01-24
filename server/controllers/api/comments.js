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
var util = require('util');
var logger = require('winston');

var Release = require('mongoose').model('Release');
var Comment = require('mongoose').model('Comment');
var api = require('./api');

var error = require('../../modules/error')('api', 'comment');

exports.create = function(req, res) {

	var assert = api.assert(error, 'create', req.user.email, res);
	Release.findOne({ id: req.params.id }, assert(function(release) {

		if (!release) {
			return api.fail(res, error('No such release with ID "%s"', req.params.id), 404);
		}
		var comment = new Comment({
			_from: req.user,
			_ref: { release: release },
			message: req.body.message,
			ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '0.0.0.0',
			created_at: new Date()
		});

		comment.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}
			comment.save(assert(function(comment) {
				logger.info('[api|comment:create] User <%s> commented on release "%s" (%s).', req.user.email, release.id, release.name);

				// fetch with references
				Comment.findById(comment._id).populate('_from').exec(assert(function(comment) {
					return api.success(res, comment.toSimple(), 201);

				}, 'Error fetching created comment from <%s>.'));
			}, 'Error saving comment from <%s>.'));
		});
	}, 'Error finding release in order to create comment from <%s>.'));
};
