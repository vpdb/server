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

const api = require('./api');
const acl = require('../../acl');
const Game = require('mongoose').model('Game');
const LogEvent = require('mongoose').model('LogEvent');
const GameRequest = require('mongoose').model('GameRequest');

const GameRequestSerializer = require('../../serializers/game_request.serializer');

const error = require('../../modules/error')('api', 'game_request');
const ipdb = require('../../modules/ipdb');
const mailer = require('../../modules/mailer');

/**
 * Creates a new game request.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	const now = new Date();
	let ipdbNumber;

	return Promise.try(() => {

		// validate ipdb number syntax
		if (!req.body.ipdb_number) {
			throw error('Validation error').validationError('ipdb_number', 'IPDB number must be provided', req.body.ipdb_number);
		}
		if (!/^\d+$/.test(req.body.ipdb_number.toString())) {
			throw error('Validation error').validationError('ipdb_number', 'Must be a whole number', req.body.ipdb_number);
		}

		ipdbNumber = parseInt(req.body.ipdb_number);
		return Game.findOne({ 'ipdb.number': ipdbNumber }).exec();

	}).then(game => {

		// check if game already exists
		if (game) {
			throw error('Validation error').validationError('ipdb_number', 'Game with IPDB number ' + ipdbNumber + ' (' + game.title + ') is already in the database!', ipdbNumber);
		}
		return GameRequest.findOne({ ipdb_number: ipdbNumber }).exec();

	}).then(gameRequest => {

		// check if game request already exists
		if (gameRequest) {
			if (gameRequest.is_closed) {
				throw error('Validation error').validationError('ipdb_number', 'This IPDB number has already been requested and closed for the following reason: ' + gameRequest.message, ipdbNumber);

			} else {
				throw error('Validation error').validationError('ipdb_number', 'This IPDB number has already been requested. Please bear with us until we close this request.', ipdbNumber);
			}
		}

		// fetch details
		return ipdb.details(ipdbNumber, { offline: req.query.ipdb_dryrun }).catch(err => {
			throw error('Error retrieving data from IPDB').validationError('ipdb_number', err.message, ipdbNumber);
		});

	}).then(ipdbData => {

		let gameRequest = new GameRequest({
			title: req.body.title,
			notes: req.body.notes,
			ipdb_number: ipdbNumber,
			ipdb_title: ipdbData.title,
			is_closed: false,
			_created_by: req.user._id,
			created_at: now
		});
		return gameRequest.save();

	}).then(gameRequest => {

		api.success(res, GameRequestSerializer.simple(gameRequest, req), 201);

		LogEvent.log(req, 'create_game_request', false, {
			game_request: _.pick(GameRequestSerializer.simple(gameRequest, req), [ 'id', 'title', 'ipdb_number', 'ipdb_title' ]),
		}, {
			game_request: gameRequest._id
		});

		return null;

	}).catch(api.handleError(res, error, 'Error creating game request'));
};

/**
 * Updates a game request.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.update = function(req, res) {

	const updateableFields = [ 'is_closed', 'message' ];

	let user;
	let requestClosed = false;
	let before;
	return Promise.try(() => {
		return GameRequest
			.findOne({ id: req.params.id })
			.populate('_created_by')
			.exec();

	}).then(gameRequest => {
		if (!gameRequest) {
			throw error('No such game request with ID "%s".', req.params.id).status(404);
		}
		user = gameRequest._created_by;

		// fail if invalid fields provided
		api.assertFields(req, updateableFields, error);

		before = _.pick(gameRequest, updateableFields);
		if (gameRequest.is_closed === false && req.body.is_closed === true) {
			if (!req.body.message) {
				throw error('Validation error').validationError('message', 'Message must be set when closing game request so the user can be notified', req.body.message);
			}
			requestClosed = true;
		}
		_.assign(gameRequest, req.body);
		return gameRequest.save();

	}).then(gameRequest => {

		LogEvent.log(req, 'update_game_request', false, {
			game_request: _.pick(GameRequestSerializer.simple(gameRequest, req), [ 'id', 'title', 'ipdb_number', 'ipdb_title' ]),
			before: before,
			after: _.pick(gameRequest, updateableFields)
		}, {
			game_request: gameRequest._id
		});

		if (requestClosed) {
			mailer.gameRequestDenied(user, gameRequest.ipdb_title, gameRequest.message);
		}

		return api.success(res, GameRequestSerializer.simple(gameRequest, req), 200);

	}).catch(api.handleError(res, error, 'Error updating game request'));
};

/**
 * Lists all game requests.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	const statusValues = [ 'open', 'closed', 'denied', 'all' ];

	return Promise.try(() => {

		const status = req.query.status || 'open';
		if (!statusValues.includes(status)) {
			throw error('Invalid status "' + status + '". Valid statuses are: [ ' + statusValues.join(', ') + ' ].');
		}

		let query;
		switch (status) {
			case 'open':
				query = { is_closed: false };
				break;
			case 'closed':
				query = { is_closed: true };
				break;
			case 'denied':
				query = { is_closed: true, _game: null };
				break;
			case 'all':
				query = {};
				break;
		}

		return GameRequest.find(query)
			.populate({ path: '_created_by' })
			.populate({ path: '_game' })
			.exec();

	}).then(requests => {
		return api.success(res, requests.map(r => GameRequestSerializer.detailed(r, req)));

	}).catch(api.handleError(res, error, 'Error listing game requests'));
};

/**
 * Deletes a game request.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	let gameRequest, canDelete;
	return Promise.try(() => {
		return acl.isAllowed(req.user.id, 'game_requests', 'delete');

	}).then(result => {
		canDelete = result;
		return GameRequest.findOne({ id: req.params.id }).exec();

	}).then(result => {
		gameRequest = result;
		if (!gameRequest) {
			throw error('No such game request with ID "%s".', req.params.id).status(404);
		}

		// only allow deleting own game requests
		if (!canDelete && !gameRequest._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}
		// remove from db
		return gameRequest.remove();

	}).then(() => {
		logger.info('[api|game request:delete] Game Request "%s" successfully deleted.', gameRequest.id);

		LogEvent.log(req, 'delete_game_request', false, {
			game_request: _.pick(GameRequestSerializer.simple(gameRequest, req), [ 'id', 'title', 'ipdb_number', 'ipdb_title' ])
		}, {
			game_request: gameRequest._id
		});

		return api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting game request'));
};
