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

var api = require('./api');

exports.auth = api.auth;
exports.anon = api.anon;
exports.ping = api.ping;
exports.files = require('./files');
exports.games = require('./games');
exports.ipdb = require('./ipdb');
exports.releases = require('./releases');
exports.roles = require('./roles');
exports.tags = require('./tags');
exports.user = require('./user');
exports.users = require('./users');
exports.userlogs = require('./userlogs');
exports.vpbuilds = require('./vpbuilds');
