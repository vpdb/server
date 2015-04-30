/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var _ = require('lodash');
var ACL = require('acl');
var logger = require('winston');
var mongoose = require('mongoose');

var User = mongoose.model('User');
var error = require('./modules/error')('acl');
var config = require('./modules/settings').current;

var redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
    redis.select(config.vpdb.redis.db);
var acl = new ACL(new ACL.redisBackend(redis, 'acl'));

var init = function(next) {

	// do at least one error check on redis
	redis.on('error', function(err) {
		logger.error('[app] Error connecting to Redis: ' + err);
		process.exit(1);
	});

	// permissions
	acl.allow([
		{
			roles: 'admin',
			allows: [
				{ resources: 'users', permissions: [ 'update', 'list', 'full-details' ]},
				{ resources: 'roles', permissions: 'list' }
			]
		}, {
			roles: 'contributor',
			allows: [
				{ resources: 'games', permissions: [ 'update', 'add', 'delete' ]},
				{ resources: 'ipdb', permissions: 'view' },
				{ resources: 'tags', permissions: 'delete' },
				{ resources: 'builds', permissions: 'delete' },
				{ resources: 'roms', permissions: 'delete' }
			]
		}, {
			roles: 'member',
			allows: [
				{ resources: 'user', permissions: [ 'view', 'update' ]},           // profile
				{ resources: 'users', permissions: [ 'view', 'search', 'star' ]},  // any other user
				{ resources: 'files', permissions: [ 'download', 'upload', 'delete' ]},      // delete: only own/inactive files
				{ resources: 'releases', permissions: [ 'add', 'delete', 'rate', 'star' ] }, // delete: only own releases and only for a given period
				{ resources: 'games', permissions: [ 'rate', 'star' ]},
				{ resources: 'tags', permissions: [ 'add', 'delete-own' ] },
				{ resources: 'tokens', permissions: [ 'add' ] },
				{ resources: 'builds', permissions: [ 'add', 'delete-own' ] },
				{ resources: 'comments', permissions: [ 'add' ] },
				{ resources: 'roms', permissions: [ 'add', 'delete-own' ] }
			]
		}, {
			roles: 'mocha',
			allows: [
				{ resources: 'users', permissions: 'delete' }
			]
		}
	])

	// hierarchy
	.then(function() { return acl.addRoleParents('root', [ 'admin', 'contributor' ]); })
	.then(function() { return acl.addRoleParents('admin', [ 'member' ]); })
	.then(function() { return acl.addRoleParents('contributor', [ 'member' ]); })

	// apply to all users
	.then(function() {
		User.find({}, function(err, users) {
			/* istanbul ignore if  */
			if (err) {
				return next(error(err, 'Error finding users for ACLs').log());
			}

			logger.info('[acl] Applying ACLs to %d users...', users.length);
			_.each(users, function(user) {
				acl.addUserRoles(user.id, user.roles);
			});
			logger.info('[acl] ACLs applied.');
			next(null, acl);
		});
	});
};

acl.init = init;
module.exports = acl;
