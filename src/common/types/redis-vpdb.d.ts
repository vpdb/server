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

import { Commands, OverloadedAsyncCommand, OverloadedAsyncKeyCommand, OverloadedCommand } from 'redis';
import { EventEmitter } from 'events';

declare module 'redis' {
	interface RedisClient extends Commands<boolean>, EventEmitter {

		/**
		 * Set the string value of a key.
		 */
		setAsync(key: string, value: string): Promise<'OK'>;
		setAsync(key: string, value: string, flag: string): Promise<'OK'>;
		setAsync(key: string, value: string, mode: string, duration: number): Promise<'OK'>;
		setAsync(key: string, value: string, mode: string, duration: number, flag: string): Promise<'OK' | undefined>;

		/**
		 * Get the value of a key.
		 */
		getAsync(key: string): Promise<string>;

		/**
		 * Add the specified members to the set stored at `key`.
		 *
		 * Specified members that are already a member of this set are ignored. If `key` does not exist, a new set is created before adding the specified members.
		 *
		 * An error is returned when the value stored at key is not a set.
		 *
		 * @param {string} key
		 * @param {string} value
		 * @returns {Promise<number>} The number of elements that were added to the set, not including all the elements already present into the set.
		 */
		saddAsync(key: string, value: string): Promise<number>;

		/**
		 * Returns all the members of the set value stored at key.
		 * @param {string} key
		 * @returns {Promise<string[]>} All elements of the set.
		 */
		smembersAsync(key: string): Promise<string[]>;

		/**
		 * Returns the members of the set resulting from the intersection of all the given sets.
		 */
		sinterAsync: OverloadedAsyncKeyCommand<string, string[]>;

		/**
		 * Returns the members of the set resulting from the union of all the given sets.
		 */
		sunionAsync: OverloadedAsyncCommand<string, string[]>;

		/**
		 * Delete a key.
		 */
		delAsync: OverloadedAsyncCommand<string, number>;

		/**
		 * Get the time to live for a key.
		 */
		ttlAsync(key: string): Promise<number>;

		/**
		 * Increment the integer value of a key by one.
		 */
		incrAsync(key: string): Promise<number>;

		/**
		 * Set a key's time to live in seconds.
		 */
		expireAsync(key: string, seconds: number): Promise<number>;
	}

	export interface OverloadedAsyncCommand<T, U> {
		(arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
		(arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): Promise<U>;
		(arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
		(arg1: T, arg2: T, arg3: T): Promise<U>;
		(arg1: T, arg2: T | T[]): Promise<U>;
		(arg1: T | T[]): Promise<U>;
		(...args: Array<T>): Promise<U>;
	}

	export interface OverloadedAsyncKeyCommand<T, U> {
		(key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
		(key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): Promise<U>;
		(key: string, arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
		(key: string, arg1: T, arg2: T, arg3: T): Promise<U>;
		(key: string, arg1: T, arg2: T): Promise<U>;
		(key: string, arg1: T| T[]): Promise<U>;
		(key: string, ...args: Array<T>): Promise<U>;
		(...args: Array<string | T>): Promise<U>;
	}
}
