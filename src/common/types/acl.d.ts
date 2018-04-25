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
// Type definitions for node_acl 0.4.8
// Project: https://github.com/optimalbits/node_acl
// Definitions by: Qubo <https://github.com/tkQubo>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

/// <reference types="bluebird" />
/// <reference types="node"/>
/// <reference types="express"/>

import http = require('http');
import Promise = require("bluebird");
import express = require("express");

type strings = string|string[];
type Value = string|number;
type Values = Value|Value[];
type Action = () => any;
type Callback = (err: Error) => any;
type AnyCallback = (err: Error, obj: any) => any;
type AllowedCallback = (err: Error, allowed: boolean) => any;
type GetUserId = (req: http.IncomingMessage, res: http.ServerResponse) => Value;

interface AclStatic {
	new (backend: Backend<any>, logger: Logger, options: Option): Acl;
	new (backend: Backend<any>, logger: Logger): Acl;
	new (backend: Backend<any>): Acl;
	memoryBackend: MemoryBackendStatic;
}

interface Logger {
	debug: (msg: string) => any;
}

interface Acl {
	/**
	 * Adds roles to a given user id.
	 * @param userIdUser id.
	 * @param roles Role(s) to add to the user id.
	 * @param cb Callback called when finished.
	 */
	addUserRoles: (userId: Value, roles: strings, cb?: Callback) => Promise<void>;
	/**
	 * Remove roles from a given user.
	 * @param {Value} userId User id.
	 * @param {strings} roles Role(s) to remove to the user id.
	 * @param {Callback} cb Callback called when finished.
	 */
	removeUserRoles: (userId: Value, roles: strings, cb?: Callback) => Promise<void>;
	/**
	 * Return all the roles from a given user.
	 * @param {Value} userId User id.
	 * @param {(err: Error, roles: string[]) => any} cb Callback called when finished.
	 */
	userRoles: (userId: Value, cb?: (err: Error, roles: string[]) => any) => Promise<string[]>;
	/**
	 * Return all users who has a given role.
	 * @param {Value} role Role name
	 * @param {(err: Error, users: Values) => any} cb Callback called when finished.
	 */
	roleUsers: (role: Value, cb?: (err: Error, users: Values) => any) => Promise<any>;
	/**
	 * Return boolean whether user has the role
	 * @param {Value} userId User id.
	 * @param {string} role Role name
	 * @param {(err: Error, isInRole: boolean) => any} cb Callback called when finished.
	 * @returns {Bluebird<boolean>}
	 */
	hasRole: (userId: Value, role: string, cb?: (err: Error, isInRole: boolean) => any) => Promise<boolean>;
	/**
	 * Adds a parent or parent list to role.
	 * @param {string} role Child role.
	 * @param {Values} parents Parent role(s) to be added.
	 * @param {Callback} cb Callback called when finished.
	 */
	addRoleParents: (role: string, parents: Values, cb?: Callback) => Promise<void>;
	/**
	 * Removes a role from the system.
	 * @param {string} role Role to be removed
	 * @param {Callback} cb Callback called when finished.
	 */
	removeRole: (role: string, cb?: Callback) => Promise<void>;
	/**
	 * Removes a resource from the system.
	 * @param {string} resource Resource to be removed
	 * @param {Callback} cb Callback called when finished.
	 */
	removeResource: (resource: string, cb?: Callback) => Promise<void>;
	allow: {
		/**
		 * Adds the given permissions to the given roles over the given resources.
		 * @param {Values} roles Role(s) to add permissions to.
		 * @param {strings} resources Resource(s) to add permisisons to.
		 * @param {strings} permissions Permission(s) to add to the roles over the resources.
		 * @param {Callback} cb Callback called when finished
		 */
		(roles: Values, resources: strings, permissions: strings, cb?: Callback): Promise<void>;
		/**
		 * Adds the given permissions to the given roles over the given resources.
		 * @param {AclSet | AclSet[]} aclSets Array with objects expressing what permissions to give.
		 */
		(aclSets: AclSet | AclSet[]): Promise<void>;
	}
	/**
	 * Remove permissions from the given roles owned by the given role.
	 * Note: we loose atomicity when removing empty role_resources.
	 * @param {string} role
	 * @param {strings} resources
	 * @param {strings} permissions
	 * @param {Callback} cb
	 */
	removeAllow: (role: string, resources: strings, permissions: strings, cb?: Callback) => Promise<void>;
	removePermissions: (role: string, resources: strings, permissions: strings, cb?: Function) => Promise<void>;
	/**
	 * Returns all the allowable permissions a given user have to access the given resources.
	 * It returns an array of objects where every object maps a resource name to a list of permissions for that resource.
	 * @param {Value} userId User id.
	 * @param {strings} resources Resource(s) to ask permissions for.
	 * @param {AnyCallback} cb Callback called when finished.
	 */
	allowedPermissions: (userId: Value, resources: strings, cb?: AnyCallback) => Promise<string[]>;
	/**
	 * Checks if the given user is allowed to access the resource for the given permissions
	 * (note: it must fulfill all the permissions).
	 * @param {Value} userId User id.
	 * @param {strings} Resources resource to ask permissions for.
	 * @param {strings} permissions Asked permissions
	 * @param {AllowedCallback} cb Callback called with the result.
	 */
	isAllowed: (userId: Value, resources: strings, permissions: strings, cb?: AllowedCallback) => Promise<boolean>;
	/**
	 * Returns true if any of the given roles have the right permissions.
	 * @param {strings} roles Role(s) to check the permissions for.
	 * @param {strings} resource Resource to ask permissions for.
	 * @param {strings} permissions Asked permissions.
	 * @param {AllowedCallback} cb Callback called with the result.
	 */
	areAnyRolesAllowed: (roles: strings, resource: strings, permissions: strings, cb?: AllowedCallback) => Promise<any>;
	whatResources: {
		/**
		 * Returns what resources a given role has permissions over.
		 * @param {strings} roles Roles
		 * @param {AnyCallback} cb Callback called with the result.
		 */
		(roles: strings, cb?: AnyCallback): Promise<any>;
		/**
		 * Returns what resources a role has the given permissions over.
		 * @param {strings} roles Roles
		 * @param {strings} permissions Permissions
		 * @param {AnyCallback} cb Callback called with the result.
		 */
		(roles: strings, permissions: strings, cb?: AnyCallback): Promise<any>;
	}
	permittedResources: (roles: strings, permissions: strings, cb?: Function) => Promise<void>;
	/**
	 * Middleware for express.
	 * To create a custom getter for userId, pass a function(req, res) which returns the userId when called (must not be async).
	 * @param {number} numPathComponents Number of components in the url to be considered part of the resource name.
	 * @param {Value | GetUserId} userId The user id for the acl system (defaults to req.session.userId)
	 * @param {strings} actions the permission(s) to check for (defaults to req.method.toLowerCase())
	 * @returns {e.RequestHandler}
	 */
	middleware: (numPathComponents?: number, userId?: Value | GetUserId, actions?: strings) => express.RequestHandler;
}

interface Option {
	buckets?: BucketsOption;
}

interface BucketsOption {
	meta?: string;
	parents?: string;
	permissions?: string;
	resources?: string;
	roles?: string;
	users?: string;
}

interface AclSet {
	roles: strings;
	allows: AclAllow[];
}

interface AclAllow {
	resources: strings;
	permissions: strings;
}

interface MemoryBackend extends Backend<Action[]> { }
interface MemoryBackendStatic {
	new (): MemoryBackend;
}

//
// For internal use
//
interface Backend<T> {
	begin: () => T;
	end: (transaction: T, cb?: Action) => void;
	clean: (cb?: Action) => void;
	get: (bucket: string, key: Value, cb?: Action) => void;
	union: (bucket: string, keys: Value[], cb?: Action) => void;
	add: (transaction: T, bucket: string, key: Value, values: Values) => void;
	del: (transaction: T, bucket: string, keys: Value[]) => void;
	remove: (transaction: T, bucket: string, key: Value, values: Values) => void;

	endAsync: Function; //TODO: Give more specific function signature
	getAsync: Function;
	cleanAsync: Function;
	unionAsync: Function;
}

interface Contract {
	(args: IArguments): Contract | NoOp;
	debug: boolean;
	fulfilled: boolean;
	args: any[];
	checkedParams: string[];
	params: (...types: string[]) => Contract | NoOp;
	end: () => void;
}

interface NoOp {
	params: (...types: string[]) => NoOp;
	end: () => void;
}

// for redis backend
import redis = require('redis');

interface AclStatic {
	redisBackend: RedisBackendStatic;
}

interface RedisBackend extends Backend<redis.RedisClient> { }
interface RedisBackendStatic {
	new (redis: redis.RedisClient, prefix: string): RedisBackend;
	new (redis: redis.RedisClient): RedisBackend;
}

// for mongodb backend
import mongo = require('mongodb');

interface AclStatic {
	mongodbBackend: MongodbBackendStatic;
}

interface MongodbBackend extends Backend<Callback> { }
interface MongodbBackendStatic {
	new (db: mongo.Db, prefix: string, useSingle: boolean): MongodbBackend;
	new (db: mongo.Db, prefix: string): MongodbBackend;
	new (db: mongo.Db): MongodbBackend;
}

declare var _: AclStatic;
export = _;
