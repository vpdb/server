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

var acl = require('../../acl');
var api = require('./api');
var Build = require('mongoose').model('Build');

var error = require('../../modules/error')('api', 'tag');

/**
 * Lists all current builds.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var q;
	if (req.user) {
		// logged users also get their own builds even if inactive.
		q = { $or: [{ is_active: true }, { _created_by: req.user._id }] };
	} else {
		q = { is_active: true };
	}

	Promise.resolve().then(function() {
		return Build.find(q).exec();

	}).then(builds => {

		// reduce
		builds = _.map(builds, build => build.toSimple());
		api.success(res, builds);

	}).catch(api.handleError(res, error, 'Error listing builds'));
};

/**
 * Creates a new build.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	var newBuild;
	Promise.resolve().then(function() {
		newBuild = new Build(req.body);

		newBuild.id = newBuild.label ? newBuild.label.replace(/(^[^a-z0-9\._-]+)|([^a-z0-9\._-]+$)/gi, '').replace(/[^a-z0-9\._-]+/gi, '-').toLowerCase() : '-';
		newBuild.is_active = false;
		newBuild.created_at = new Date();
		newBuild._created_by = req.user._id;

		return newBuild.validate();

	}).then(function() {
		return newBuild.save();

	}).then(function() {
		logger.info('[api|build:create] Build "%s" successfully created.', newBuild.label);
		api.success(res, newBuild.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating build'));
};


/**
 * Deletes a build.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var canDelete, build;
	Promise.resolve().then(function() {
		return acl.isAllowed(req.user.id, 'builds', 'delete');

	}).then(isAllowed => {
		canDelete = isAllowed;
		return Build.findOne({ id: req.params.id });

	}).then(b => {
		build = b;

		// fail on 404
		if (!build) {
			throw error('No such builds with ID "%s".', req.params.id).status(404);
		}

		// fail when not owner
		if (!canDelete && !build._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}

		// all ok, delete
		return build.remove();

	}).then(function() {
		logger.info('[api|build:delete] Build "%s" (%s) successfully deleted.', build.label, build.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting build'));
};
