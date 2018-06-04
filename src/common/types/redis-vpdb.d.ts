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

import { Commands } from 'redis';
import { EventEmitter } from 'events';

declare module 'redis' {
	interface RedisClient extends Commands<boolean>, EventEmitter {
		setAsync(key: string, value: string): Promise<void>;

		getAsync(key: string): Promise<string>;

		hsetAsync(hash: string, key: string, value: string): Promise<void>;

		hgetAsync(hash: string, key: string): Promise<string>;

		delAsync(key: string): Promise<void>;

		ttlAsync(key: string): Promise<number>;

		incrAsync(key: string): Promise<number>;

		expireAsync(key: string, seconds: number): Promise<number>;
	}
}
