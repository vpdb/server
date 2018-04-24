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

import ACL = require('acl');
import { logger } from './logger';
import { config } from './settings';
import { server } from '../server';

const redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });

redis.select(config.vpdb.redis.db);
redis.on('error', (err:Error) => logger.error('[acl] Redis error: %s', err.message));

export const acl = new ACL(new ACL.redisBackend(redis, 'acl'));

/**
 * Initializes the ACLs.
 */
export async function init():Promise<void> {

	// do at least one error check on redis
	redis.on('error', /* istanbul ignore next */ (err:Error) => {
		logger.error('[app] Error connecting to Redis: ' + err);
		process.exit(1);
	});

	// permissions
	await acl.allow([
		{
			roles: 'admin',
			allows: [
				{ resources: 'tokens', permissions: ['application-token'] },
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
	]);

	await acl.addRoleParents('root', [ 'admin', 'moderator' ]);
	await acl.addRoleParents('admin', [ 'member' ]);
	await acl.addRoleParents('moderator', [ 'contributor' ]);
	await acl.addRoleParents('contributor', [ 'game-contributor', 'release-contributor', 'backglass-contributor' ]);
	await acl.addRoleParents('game-contributor', [ 'member' ]);
	await acl.addRoleParents('release-contributor', [ 'member' ]);
	await acl.addRoleParents('backglass-contributor', [ 'member' ]);
	const users = await server.models().User.find({}).exec();
	logger.info('[acl] Applying ACLs to %d users...', users.length);
	for (let user of users) {
		await acl.addUserRoles(user.id, user.roles);
	}
	logger.info('[acl] ACLs applied.');
}