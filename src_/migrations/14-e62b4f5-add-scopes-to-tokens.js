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

const mongoose = require('mongoose');
const Token = mongoose.model('Token');

/**
 * This does the following for each stored token:
 *
 * - if type == "login": change to "personal", set scopes: ["login"]
 * - if type == "access": change to "personal", set scopes: ["all"]
 */
module.exports.up = function() {

	let counter = 0;

	return Token.find({}).exec().then(tokens => {

		console.log('Got %s tokens, migrating to new scopes.', tokens.length);
		return Promise.each(tokens, token => {
			if (token.type === 'login') {
				counter++;
				token.type = 'personal';
				token.scopes = ['login'];
				return token.save();
			}
			if (token.type === 'access') {
				counter++;
				token.type = 'personal';
				token.scopes = ['all'];
				return token.save();
			}
			return null;
		});

	}).then(() => {
		console.log('Updated %s tokens.', counter);
		return null;
	});
};