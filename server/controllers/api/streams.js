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

const dmdStreams = require('../../modules/dmdstream');
const error = require('../../modules/error')('api', 'tag');
const acl = require('../../acl');
const api = require('./api');

exports.view = function(req, res) {
	Promise.try(() => {
		res.writeHead(206, { 'Content-Type': 'video/mp4' });
		if (!dmdStreams.stream(res)) {
			throw error('No stream available').status(404);
		}

	}).catch(api.handleError(res, error, 'Error retrieving stream'));
};