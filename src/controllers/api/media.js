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

'use strict';

const _ = require('lodash');
const logger = require('winston');

const acl = require('../../acl');
const api = require('./api');
const Game = require('mongoose').model('Game');
const Medium = require('mongoose').model('Medium');

const error = require('../../modules/error')('api', 'medium');

/**
 * Creates a new medium.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	const now = new Date();
	let medium;

	Promise.try(function() {

		return Medium.getInstance(_.extend(req.body, {
			_created_by: req.user._id,
			created_at: now
		}));

	}).then(newMedium => {
		medium = newMedium;
		return medium.validate();

	}).then(() => {
		logger.info('[api|medium:create] Validations passed.');
		return medium.save();

	}).then(() => {
		logger.info('[api|medium:create] Medium "%s" successfully created.', medium.id);
		return medium.activateFiles();

	}).then(() => {
		return Medium.findById(medium._id)
			.populate({ path: '_ref.game' })
			.populate({ path: '_ref.release' })
			.populate({ path: '_created_by' })
			.populate({ path: '_file' })
			.exec();

	}).then(populatedMedium => {

		api.success(res, populatedMedium.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating medium'));
};

/**
 * Lists all media.
 *
 * Currently, this is only used under /games/{game_id}/media, so params.gameId is mandatory.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	Promise.resolve().then(() => {
		return Game.findOne({ id: req.params.gameId }).exec();

	}).then(game => {

		if (!game) {
			throw error('Unknown game "%s".', req.params.gameId).status(404);
		}
		return Medium.find({ '_ref.game': game._id })
			.populate({ path: '_created_by' })
			.populate({ path: '_file' })
			.exec();

	}).then(media => {
		api.success(res, media.map(m => m.toSimple()));

	}).catch(api.handleError(res, error, 'Error listing media'));
};

/**
 * Deletes a medium.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	let medium;
	let canDelete;
	Promise.try(() => {
		return acl.isAllowed(req.user.id, 'media', 'delete');

	}).then(result => {
		canDelete = result;
		return Medium.findOne({ id: req.params.id }).exec();

	}).then(result => {

		medium = result;
		if (!medium) {
			throw error('No such medium with ID "%s".', req.params.id).status(404);
		}

		// only allow deleting own roms
		if (!canDelete && !medium._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}
		// remove from db
		return medium.remove();

	}).then(() => {
		logger.info('[api|medium:delete] Medium "%s" successfully deleted.', medium.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting medium'));
};
