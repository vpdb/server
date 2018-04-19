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

const ACL = require('acl');
const logger = require('winston');
const mongoose = require('mongoose');

const config = require('./settings').current;

const redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });

redis.select(config.vpdb.redis.db);
redis.on('error', err => logger.error('[acl] Redis error: %s', err.message));

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
				{ resources: 'tokens', permissions: ['provider-token'] },
				{ resources: 'roles',  permissions: ['list'] },
				{ resources: 'users',  permissions: ['update', 'list', 'full-details', 'send-confirmation'] }
			]
		}, {
			roles: 'moderator',
			allows: [
				{ resources: 'backglasses',   permissions: ['delete', 'moderate', 'update', 'view-restriced'] },
				{ resources: 'builds',        permissions: ['delete', 'update'] },
				{ resources: 'files',         permissions: ['blockmatch'] },
				{ resources: 'games',         permissions: ['delete'] },
				{ resources: 'game_requests', permissions: ['list', 'update', 'delete'] },
				{ resources: 'media',         permissions: ['delete'] },
				{ resources: 'releases',      permissions: ['moderate', 'view-restriced', 'update', 'validate'] },
				{ resources: 'roms',          permissions: ['delete', 'view-restriced'] },
				{ resources: 'tags',          permissions: ['delete'] }
			]
		}, {
			roles: 'contributor',
			allows: [ { resources: 'roms', permissions: ['add', 'delete-own']  } ]
		}, {
			roles: 'game-contributor',
			allows: [
				{ resources: 'games', permissions: ['update', 'add'] },
				{ resources: 'ipdb',  permissions: ['view'] },
			]
		}, {
			roles: 'release-contributor',
			allows: [ { resources: 'releases', permissions: ['auto-approve'] }, ]
		}, {
			roles: 'backglass-contributor',
			allows: [ { resources: 'backglasses', permissions: ['auto-approve'] } ]
		}, {
			roles: 'member',
			allows: [
				{ resources: 'backglasses',   permissions: ['add', 'delete-own', 'update-own', 'star'] },
				{ resources: 'builds',        permissions: ['add', 'delete-own'] },
				{ resources: 'comments',      permissions: ['add'] },
				{ resources: 'files',         permissions: ['download', 'delete-own', 'upload'] },
				{ resources: 'games',         permissions: ['rate', 'star'] },
				{ resources: 'game_requests', permissions: ['add', 'delete-own'] },
				{ resources: 'media',         permissions: ['add', 'delete-own', 'star'] },
				{ resources: 'messages',      permissions: ['receive'] },
				{ resources: 'releases',      permissions: ['add', 'delete-own', 'update-own', 'rate', 'star'] },
				{ resources: 'tags',          permissions: ['add', 'delete-own'] },
				{ resources: 'tokens',        permissions: ['add', 'delete-own', 'update-own', 'list'] },
				{ resources: 'user',          permissions: ['view', 'update'] },                          // profile
				{ resources: 'users',         permissions: ['view', 'search', 'star'] }                   // any other user
			]
		}, {
			roles: 'mocha',
			allows: [
				{ resources: 'users', permissions: 'delete' }
			]
		}
	])
	.then(() => acl.addRoleParents('root', [ 'admin', 'moderator' ]))
	.then(() => acl.addRoleParents('admin', [ 'member' ]))
	.then(() => acl.addRoleParents('moderator', [ 'contributor' ]))
	.then(() => acl.addRoleParents('contributor', [ 'game-contributor', 'release-contributor', 'backglass-contributor' ]))
	.then(() => acl.addRoleParents('game-contributor', [ 'member' ]))
	.then(() => acl.addRoleParents('release-contributor', [ 'member' ]))
	.then(() => acl.addRoleParents('backglass-contributor', [ 'member' ]))
	.then(() => mongoose.model('User').find({}))
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