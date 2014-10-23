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
var logger = require('winston');

var api = require('./api');
var VPBuild = require('mongoose').model('VPBuild');

var error = require('../../modules/error')('api', 'tag');

exports.list = function(req, res) {

	var q;
	if (req.user) {
		// logged users also get their own vpbuilds even if inactive.
		q = { $or: [{ is_active: true }, { _created_by: req.user._id }] };
	} else {
		q = { is_active: true };
	}
	VPBuild.find(q, function(err, vpbuilds) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding vpbuilds').log('list'), 500);
		}

		// reduce
		vpbuilds = _.map(vpbuilds, function(vpbuild) {
			return vpbuild.toSimple();
		});
		api.success(res, vpbuilds);
	});
};


exports.create = function(req, res) {

	var newBuild = new VPBuild(req.body);

	newBuild.id = newBuild.name ? newBuild.name.replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/gi, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '-';
	newBuild.is_active = false;
	newBuild.created_at = new Date();
	newBuild._created_by = req.user._id;

	newBuild.validate(function(err) {
		if (err) {
			return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
		}
		newBuild.save(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error saving vpbuild "%s"', newBuild.name).log('create'), 500);
			}
			logger.info('[api|vpbuild:create] VPBuild "%s" successfully created.', newBuild.name);
			return api.success(res, newBuild.toSimple(), 201);
		});
	});
};