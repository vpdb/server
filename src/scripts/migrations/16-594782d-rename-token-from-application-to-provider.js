/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

const mongoose = require('mongoose');
const Token = mongoose.model('Token');

/**
 * This does the following for each stored token:
 *
 * - if type == "application": change to "provider".
 */
module.exports.up = function() {

	let counter = 0;

	return Token.find({ type: 'application' }).exec().then(tokens => {
		counter = tokens.length;
		console.log('Got %s application tokens, changing to "provider".', tokens.length);
		return Promise.each(tokens, token => {
			token.type = 'provider';
			return token.save();
		});

	}).then(() => {
		console.log('Updated %s tokens.', counter);
		return null;
	});
};