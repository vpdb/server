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

var error = require('../../modules/error')('api', 'tag');
var api = require('./api');
var Tag = require('mongoose').model('Tag');

exports.list = function(req, res) {

	var q;
	if (req.user) {
		// logged users also get their own tags even if inactive.
		q = { $or: [{ is_active: true }, { _created_by: req.user._id }] };
	} else {
		q = { is_active: true };
	}
	Tag.find(q, function(err, tags) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error listing tags').log('list'), 500);
		}

		// reduce
		tags = _.map(tags, function(tag) {
			return tag.toSimple();
		});
		api.success(res, tags);
	});
};


exports.create = function(req, res) {

	var newTag = new Tag(req.body);
	newTag.id = newTag.name ? newTag.name.replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/gi, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '-';
	newTag.is_active = false;
	newTag.created_at = new Date();
	newTag._created_by = req.user._id;

	newTag.validate(function(err) {
		if (err) {
			return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
		}
		newTag.save(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error saving tag "%s"', newTag.name).log('create'), 500);
			}
			logger.info('[api|tag:create] Tag "%s" successfully created.', newTag.name);
			return api.success(res, newTag.toSimple(), 201);
		});
	});
};