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

const _ = require('lodash');
const logger = require('winston');

const api = require('./api');
const Game = require('mongoose').model('Game');
const GameRequest = require('mongoose').model('GameRequest');

const error = require('../../modules/error')('api', 'game_request');
const ipdb = require('../../modules/ipdb');

/**
 * Creates a new game request.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	const now = new Date();
	let ipdbNumber;

	Promise.try(function() {

		// validate ipdb number syntax
		if (!req.body.ipdb_number) {
			throw error('Validation error').validationError('ipdb_number', 'Must be provided', req.body.ipdb_number);
		}
		if (!/^\d+$/.test(req.body.ipdb_number.toString())) {
			throw error('Validation error').validationError('ipdb_number', 'Must be a whole number', req.body.ipdb_number);
		}

		ipdbNumber = parseInt(req.body.ipdb_number);
		return Game.findOne({ 'ipdb.number': ipdbNumber }).exec();

	}).then(game => {

		// check if game already exists
		if (game) {
			throw error('Validation error').validationError('ipdb_number', 'Game with IPDB number ' + ipdbNumber + ' is already in the database!', ipdbNumber);
		}

		// fetch details
		return ipdb.details(ipdbNumber).catch(err => {
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

		// TODO notify
		api.success(res, gameRequest.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error creating game request'));
};
