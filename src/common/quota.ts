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

import { isArray, isObject, isUndefined, sum } from 'lodash';
import { VpdbQuotaConfig } from './types/config';
import { User } from '../users/user';
import { Context } from 'context';
import { ApiError } from './api.error';
import { config } from './settings';
import { logger } from './logger';
import { File} from '../files/file';
import { FileVariation } from '../files/file.variations';
import { FileDocument } from '../files/file.document';
import { state } from '../state';

export class Quota {

	private readonly namespace = 'quota';
	private readonly config: VpdbQuotaConfig = config.vpdb.quota;
	//private readonly rateLimiter: { [key: string]: any } = {};
	private readonly durations:Map<string, number> = new Map();

	/**
	 * Initializes quota plans
	 */
	constructor() {
		logger.info('[Quota] Initializing quotas...');

		this.durations.set('minute', 60000);
		this.durations.set('hour', this.durations.get('minute') * 60);
		this.durations.set('day', this.durations.get('hour') * 24);
		this.durations.set('week', this.durations.get('day') * 7);
		this.durations.set('month', this.durations.get('day') * 31);

		// we create a quota module for each duration
		// this.config.plans.forEach(plan => {
		// 	if (plan.unlimited === true) {
		// 		logger.info('[Quota] Skipping unlimited plan "%s".', plan.id);
		// 		return;
		// 	}
		// 	logger.info('[Quota] Setting up quota per %s for plan %s...', plan.per, plan.id);
		// 	this.rateLimiter[plan.id] = new RateLimiter({
		// 		db: state.redis,
		// 		max: plan.credits,
		// 		duration: this.durations.get(plan.per),
		// 		namespace: this.namespace
		// 	});
		// });
	}

	private async apply(user:User, weight:number):Promise<UserQuota> {
		let plan = user.planConfig;
		/* istanbul ignore if: That's a configuration error. */
		if (!plan) {
			throw new ApiError('Unable to find plan "%s" for user.', user._plan);
		}

		const period = this.durations.get(plan.per);
		const key = `${this.namespace}:${user.id}`;
		const now = Date.now();
		const member = JSON.stringify({ t: now, w: weight });

		const res = await state.redis
			.multi()
			.zadd(key, String(now), member)  // add current
			.zrange(key, 0, -1)        // get all
			.exec();

		const all = res[1][1];
		let oldest:number;
		if (all.length === 1) {
			await state.redis.pexpire(key, period);
			oldest = now;
		} else {
			oldest = JSON.parse(all[0]).t;
		}
		const count = sum(all.map((m:string) => JSON.parse(m).w));
		return {
			limit: plan.credits,
			period: period,
			remaining: count < plan.credits ? plan.credits - count : 0,
			reset: Math.ceil((oldest + period) / 1000)
		};
	}

	/**
	 * Returns the current rate limits for the given user.
	 *
	 * @param {User} user User
	 * @return {Promise<UserQuota>} Remaining quota
	 */
	public async getCurrent(user: User): Promise<UserQuota> {
		let plan = user.planConfig;
		/* istanbul ignore if: That's a configuration error. */
		if (!plan) {
			throw new ApiError('Unable to find plan "%s" for user.', user._plan);
		}

		// unlimited?
		if (plan.unlimited === true) {
			return { unlimited: true, limit: 0, period: 0, remaining: 0, reset: 0 };
		}

		const period = this.durations.get(plan.per);
		const key = `${this.namespace}:${user.id}`;
		const now = Date.now();

		const range = await state.redis.zrange(key, 0, now);
		let remaining, reset;
		if (range.length === 0) {
			remaining = plan.credits;
			reset = period / 1000;
		} else {
			const count = sum(range.map((m:string) => JSON.parse(m).weight));
			const oldest = JSON.parse(range[0]).t;
			remaining = count < plan.credits ? plan.credits - count : 0;
			reset = Math.ceil((oldest + period) / 1000);
		}

		return {
			unlimited: false,
			limit: plan.credits,
			period: period / 1000,
			remaining: remaining,
			reset: reset
		};
	}

	/**
	 * Checks if there is enough quota for the given file and consumes the quota.
	 * It also adds the rate limit headers to the request.
	 *
	 * @param {Context} ctx Koa context
	 * @param {File[]} files File(s) to check for
	 * @throws ApiError If not enough quota is left
	 */
	public async assert(ctx: Context, files: File | File[]): Promise<void> {

		if (!isArray(files)) {
			files = [files];
		}

		const plan = ctx.state.user.planConfig;
		/* istanbul ignore if: That would be configuration error. */
		if (!plan) {
			throw new ApiError('No quota defined for plan "%s"', ctx.state.user._plan);
		}

		// allow unlimited plans
		if (plan.unlimited === true) {
			this.setHeader(ctx, { limit: 0, remaining: 0, reset: 0, period: 0, unlimited: true });
			return;
		}
		const sum = this.getTotalCost(files);

		// don't even check quota if weight is 0
		if (sum === 0) {
			return;
		}

		let quota = await this.getCurrent(ctx.state.user);
		if (quota.remaining < sum) {
			this.setHeader(ctx, quota);
			throw new ApiError('Not enough quota left, requested %s of %s available. Try again in %sms.',
				sum, quota.remaining, quota.reset).status(403);
		}

		quota = await this.apply(ctx.state.user, sum);
		this.setHeader(ctx, quota);
	}

	/**
	 * Sets the rate-limit header.
	 *
	 * @param {Context} ctx Koa context
	 * @param {UserQuota} quota Current user quota
	 */
	public setHeader(ctx: Context, quota:UserQuota) {
		ctx.response.set({
			'X-RateLimit-Limit': String(quota.limit),
			'X-RateLimit-Remaining': String(quota.remaining),
			'X-RateLimit-Reset': String(quota.reset),
			'X-RateLimit-Unlimited': String(!!quota.unlimited),
		});
	}

	/**
	 * Sums up the const of a given list of files.
	 * @param {File[]} files Files to calculate cost for
	 * @return {number} Total cost
	 */
	public getTotalCost(files: File[]): number {
		let file, sum = 0;
		for (let i = 0; i < files.length; i++) {
			file = files[i];
			let cost = this.getCost(file);
			// a free file
			if (cost === 0) {
				continue;
			}
			sum += cost;
		}
		return sum;
	}

	/**
	 * Returns the cost of a given file and variation.
	 *
	 * @param {File} file Potentially dehydrated File
	 * @param {string|object} [variation] Optional variation
	 * @returns {*}
	 */
	getCost(file: File, variation: FileVariation = null) {

		if (!file.file_type) {
			logger.error(require('util').inspect(file));
			throw new ApiError('File object must be populated when retrieving costs.');
		}

		let cost = this.config.costs[file.file_type] as any; // tried to type but failed..

		// undefined file_types are free
		if (isUndefined(cost)) {
			logger.warn('[Quota.getCost] Undefined cost for file_type "%s".', file.file_type);
			return 0;
		}

		// if a variation is demanded and cost contains variation def, ignore the rest.
		if (variation && variation.name && !isUndefined(cost.variation)) {
			if (isObject(cost.variation)) {
				if (isUndefined(cost.variation[variation.name])) {
					if (isUndefined(cost.variation['*'])) {
						logger.warn('[Quota.getCost] No cost defined for %s file of variation %s and no fallback given, returning 0.', file.file_type, variation.name);
						return 0;
					}
					cost = cost.variation['*'];
				} else {
					cost = cost.variation[variation.name];
				}
			} else {
				return cost.variation;
			}
		}

		if (isObject(cost)) {
			if (isUndefined(cost.category)) {
				logger.warn('[Quota.getCost] No cost defined for %s file (type is undefined).', file.file_type, FileDocument.getMimeCategory(file, variation));
				return 0;
			}
			if (isObject(cost.category)) {
				const costCategory = cost.category[FileDocument.getMimeCategory(file, variation)];
				if (isUndefined(costCategory)) {
					if (isUndefined(cost.category['*'])) {
						logger.warn('[Quota.getCost] No cost defined for %s file of type %s and no fallback given, returning 0.', file.file_type, FileDocument.getMimeCategory(file, variation));
						return 0;
					}
					return cost.category['*'];
				}
				return costCategory;
			}
			return cost.category;
		}
		return cost;
	}
}

export interface UserQuota {
	/**
	 * True if no quota is applied, false otherwise.
	 */
	unlimited?: boolean;
	/**
	 * Current duration, in seconds
	 */
	period: number;
	/**
	 * Number of total credits during a period
	 */
	limit: number;
	/**
	 * Remaining credits of the current period
	 */
	remaining: number;
	/**
	 * How long until period ends, in seconds.
	 */
	reset: number
}

export const quota = new Quota();
