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

var error = require('../../modules/error')('api', 'tag');
var acl = require('../../acl');
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

	Tag.find(q).exec().then(function(tags) {
		// reduce
		tags = _.map(tags, function(tag) {
			return tag.toSimple();
		});
		api.success(res, tags);

	}).then(null, function(err) {
		api.fail(res, error(err, 'Error listing tags').log('list'), 500);
	});
};

exports.create = function(req, res) {

	var newTag = new Tag(_.extend(req.body, {
		_id: req.body.name ? req.body.name.replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/gi, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '-',
		is_active: false,
		created_at: new Date(),
		_created_by: req.user._id
	}));

	newTag.validate().then(function() {
		return newTag.save();

	}).then(function() {
		logger.info('[api|tag:create] Tag "%s" successfully created.', newTag.name);
		api.success(res, newTag.toSimple(), 201);

	}).then(null, function(err) {
		if (err.errors) {
			api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
		} else {
			api.fail(res, error(err, 'Error saving tag "%s"', newTag.name).log('create'), 500);
		}
	});
};


/**
 * Deletes a tag.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var tag, canGloballyDeleteTags;
	acl.isAllowed(req.user.id, 'tags', 'delete').then(function(canDelete) {

		canGloballyDeleteTags = canDelete;
		if (!canDelete) {
			return acl.isAllowed(req.user.id, 'tags', 'delete-own');
		} else {
			return true;
		}

	}).then(function(canDelete) {

		if (!canDelete) {
			throw new api.AccessDeniedError('You cannot delete tags.');
		}
		return Tag.findById(req.params.id);

	}).then(function(t) {
		tag  = t;

		// tag must exist
		if (!tag) {
			throw new api.NotFoundError();
		}

		// only allow deleting own tags
		if (!canGloballyDeleteTags && !tag._created_by.equals(req.user._id)) {
			throw new api.AccessDeniedError('Permission denied, must be owner.');
		}
		// todo check if there are references
		return tag.remove();

	}).then(function() {

		logger.info('[api|tag:delete] Tag "%s" (%s) successfully deleted.', tag.name, tag._id);
		api.success(res, null, 204);

	}).catch(api.AccessDeniedError, function(err) {
		api.fail(res, error(err), 403);

	}).catch(api.NotFoundError, function() {
		api.fail(res, error('No such tag with ID "%s".', req.params.id), 404);

	}).catch(function(err) {

		//api.fail(res, error(err, 'Error deleting tag "%s" (%s)', tag._id, tag.name).log('delete'), 500);
		api.fail(res, error(err, 'Error checking for ACL "tags/delete".').log('create'), 500);
	});
};
