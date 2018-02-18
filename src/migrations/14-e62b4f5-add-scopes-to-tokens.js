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
 * - if type == "application": change to "personal", set scopes: ["all"]
 * @param grunt
 */
module.exports.up = function(grunt) {

	let counter = 0;
	return new Promise((resolve, reject) => {
		Token.collection.find({}, function(err, cursor) {
			if (err) {
				return reject(err);
			}
			resolve(cursor.toArray());
		});

	}).then(tokens => {
		grunt.log.writeln('Got %s tokens, migrating to new scopes.', tokens.length);
		return Promise.each(tokens, token => {
			if (token.type === 'login') {
				return new Promise((resolve, reject) => {
					Token.collection.updateOne({ _id: token._id }, {
						$set: { type: 'personal', scopes: [ 'login' ] }
					}, (err, result) => {
						if (err) {
							return reject(err);
						}
						counter++;
						resolve(result);
					});
				});
			}
			if (token.type === 'application') {
				return new Promise((resolve, reject) => {
					Token.collection.updateOne({ _id: token._id }, {
						$set: { type: 'personal', scopes: [ 'all' ] }
					}, (err, result) => {
						if (err) {
							return reject(err);
						}
						counter++;
						resolve(result);
					});
				});
			}
		});

	}).then(() => {
		grunt.log.writeln('Updated %s tokens.', counter);
	});
};