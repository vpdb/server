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

import { state } from '../state';
import { logger } from './logger';

export const acl = new ACL(new ACL.redisBackend(state.redis, 'acl'));

/**
 * Initializes the ACLs.
 */
export async function init(): Promise<void> {

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
			allows: [{ resources: 'roms', permissions: ['add', 'delete-own'] }]
		}, {
			roles: 'game-contributor',
			allows: [
				{ resources: 'games', permissions: ['update', 'add'] },
				{ resources: 'ipdb',  permissions: ['view'] },
			]
		}, {
			roles: 'release-contributor',
			allows: [{ resources: 'releases', permissions: ['auto-approve'] }]
		}, {
			roles: 'backglass-contributor',
			allows: [{ resources: 'backglasses', permissions: ['auto-approve'] }]
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

	// this must reflect what's described below in roles.
	await acl.addRoleParents('root', ['admin', 'moderator']);
	await acl.addRoleParents('admin', ['member']);
	await acl.addRoleParents('moderator', ['contributor']);
	await acl.addRoleParents('contributor', ['game-contributor', 'release-contributor', 'backglass-contributor']);
	await acl.addRoleParents('game-contributor', ['member']);
	await acl.addRoleParents('release-contributor', ['member']);
	await acl.addRoleParents('backglass-contributor', ['member']);

	logger.info('[acl.init] Added permissions to roles.');
	const users = await state.models.User.find({}).lean().exec();
	logger.info('[acl.init] Applying ACLs to %d users...', users.length);
	for (let user of users) {
		await acl.addUserRoles(user.id, user.roles);
	}
	logger.info('[acl.init] ACLs applied.');
}

export const roles:Role[] = [
	{
		id: 'root',
		name: 'root',
		description: 'Super user. Can create, edit and delete everything including admins.',
		parents: ['admin', 'moderator']
	}, {
		id: 'admin',
		name: 'Administrator',
		description: 'User administrator. Can edit users and roles. Inherits from member.',
		parents: ['member']
	}, {
		id: 'moderator',
		name: 'Moderator',
		description: 'Can moderate and delete all entities. Inherits from contributor.',
		parents: ['contributor']
	}, {
		id: 'contributor',
		name: 'Contributor',
		description: 'Can upload releases, backglasses and ROMs without approval, as well as add and edit games. Inherits from all other contributors.',
		parents: ['game-contributor', 'release-contributor', 'backglass-contributor']
	}, {
		id: 'game-contributor',
		name: 'Game Contributor',
		description: 'Can add and edit game data. Inherits from member.',
		parents: ['member']
	}, {
		id: 'release-contributor',
		name: 'Release Contributor',
		description: 'Can upload releases without approval. Inherits from member.',
		parents: ['member']
	}, {
		id: 'backglass-contributor',
		name: 'Backglass Contributor',
		description: 'Can upload backglasses without approval. Inherits from member.',
		parents: ['member']
	}, {
		id: 'member',
		name: 'Member',
		description: 'A registered member. This role every user should have. Removing results in having the same permissions as anonymous.',
		parents: []
	},
];

export interface Role {
	id: string;
	name: string;
	description: string;
	parents: string[];
}