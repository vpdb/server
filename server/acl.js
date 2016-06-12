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
const ACL = require('acl');
const logger = require('winston');
const mongoose = require('mongoose');

const User = mongoose.model('User');
const error = require('./modules/error')('acl');
const config = require('./modules/settings').current;

const redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });

redis.select(config.vpdb.redis.db);
redis.on('error', console.error.bind(console));

const acl = new ACL(new ACL.redisBackend(redis, 'acl'));

/**
 * Initializes the ACLs.
 *
 * @return {Promise.<ACL>}
 */
acl.init = function() {

	// do at least one error check on redis
	redis.on('error', /* istanbul ignore next */ function(err) {
		logger.error('[app] Error connecting to Redis: ' + err);
		process.exit(1);
	});

	// permissions
	return acl.allow([
		{
			roles: 'admin',
			allows: [
				{ resources: 'users', permissions: ['update', 'list', 'full-details'] },
				{ resources: 'roles', permissions: 'list' }
			]
		}, {
			roles: 'contributor',
			allows: [
				{ resources: 'games', permissions: ['update', 'add', 'delete'] },
				{ resources: 'ipdb', permissions: 'view' },
				{ resources: 'tags', permissions: 'delete' },
				{ resources: 'builds', permissions: 'delete' },
				{ resources: 'roms', permissions: 'delete' },
				{ resources: 'backglasses', permissions: 'delete' }
			]
		}, {
			roles: 'member',
			allows: [
				{ resources: 'user', permissions: ['view', 'update'] },                              // profile
				{ resources: 'users', permissions: ['view', 'search', 'star'] },                     // any other user
				{ resources: 'files', permissions: ['download', 'upload', 'delete'] },               // delete: only own/inactive files
				{ resources: 'releases', permissions: ['add', 'delete', 'update', 'rate', 'star'] }, // delete: only own releases and only for a given period
				{ resources: 'games', permissions: ['rate', 'star'] },
				{ resources: 'tags', permissions: ['add', 'delete-own'] },
				{ resources: 'tokens', permissions: ['add', 'list', 'delete', 'update'] },
				{ resources: 'builds', permissions: ['add', 'delete-own'] },
				{ resources: 'comments', permissions: ['add'] },
				{ resources: 'roms', permissions: ['add', 'delete-own'] },
				{ resources: 'backglasses', permissions: ['add', 'delete-own'] },
				{ resources: 'messages', permissions: ['receive'] }
			]
		}, {
			roles: 'mocha',
			allows: [
				{ resources: 'users', permissions: 'delete' }
			]
		}
	])
	.then(() => acl.addRoleParents('root', [ 'admin', 'contributor' ]))
	.then(() => acl.addRoleParents('admin', [ 'member' ]))
	.then(() => acl.addRoleParents('contributor', [ 'member' ]))
	.then(() => User.find({}))
	.then(users => {
		logger.info('[acl] Applying ACLs to %d users...', users.length);
		return Promise.each(users, user => {
			/* istanbul ignore next: No initial users in test suite */
			return acl.addUserRoles(user.id, user.roles);
		});

	}).then(() => {
		logger.info('[acl] ACLs applied.');
		return acl;

	});
};

module.exports = acl;