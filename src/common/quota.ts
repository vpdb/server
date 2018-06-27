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
import { VpdbPlanCategoryCost, VpdbPlanCost, VpdbQuotaConfig } from './typings/config';
import { User } from '../users/user';
import { ApiError } from './api.error';
import { config } from './settings';
import { logger } from './logger';
import { File } from '../files/file';
import { FileVariation } from '../files/file.variations';
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { Context } from './typings/context';

export class Quota {

	private readonly namespace = 'quota';
	private readonly config: VpdbQuotaConfig = config.vpdb.quota;
	private readonly durations:Map<string, number> = new Map();

	/**
	 * Initializes quota plans
	 */
	constructor() {
		this.durations.set('minute', 60000);
		this.durations.set('hour', this.durations.get('minute') * 60);
		this.durations.set('day', this.durations.get('hour') * 24);
		this.durations.set('week', this.durations.get('day') * 7);
		this.durations.set('month', this.durations.get('day') * 31);
	}

	/**
	 * Consumes a quota and returns the user's updated quota config.
	 *
	 * @param {User} user User to consume quota for
	 * @param {number} weight How much to consume
	 * @return {Promise<UserQuota>} Updated quota after consumption
	 */
	private async consume(user:User, weight:number):Promise<UserQuota> {
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
			.zrange(key, 0, -1)   // get all
			.exec();

		const all = res[1][1];
		const count = sum(all.map((m:string) => JSON.parse(m).w));
		let oldest:number;
		if (all.length === 1) {
			await state.redis.pexpire(key, period);
			oldest = now;
			logger.info('[Quota.consume] New period starting with %s remaining credits after consuming %s.', plan.credits - count, weight);
		} else {
			oldest = JSON.parse(all[0]).t;
			logger.info('[Quota.consume] Existing period updated with %s remaining credits after consuming %s.', plan.credits - count, weight);
		}
		return {
			limit: plan.credits,
			period: period / 1000,
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
	public async get(user: User): Promise<UserQuota> {
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
			logger.info('[Quota.get] No active period, full credits apply.');
		} else {
			const count = sum(range.map((m:string) => JSON.parse(m).w));
			const oldest = JSON.parse(range[0]).t;
			remaining = count < plan.credits ? plan.credits - count : 0;
			reset = Math.ceil((oldest + period) / 1000);
			logger.info('[Quota.get] Active period started %ss ago, %s credits remaining.', (now - oldest) / 1000, remaining);
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

		let quota = await this.get(ctx.state.user);
		if (quota.remaining < sum) {
			this.setHeader(ctx, quota);
			throw new ApiError('No more quota left, requested %s of %s available. Try again in %ss.',
				sum, quota.remaining, quota.reset).status(403);
		}

		quota = await this.consume(ctx.state.user, sum);
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
	getCost(file: File, variation: FileVariation = null): number {

		// if already set, return directly.
		if (!variation && !isUndefined(file.cost)) {
			return file.cost;
		}
		if (variation && file.variations && file.variations[variation.name] && !isUndefined(file.variations[variation.name].cost)) {
			return file.variations[variation.name].cost;
		}

		/* istanbul ignore if: Should not happen if configured correctly */
		if (!file.file_type) {
			logger.error(require('util').inspect(file));
			throw new ApiError('File object must be populated when retrieving costs.');
		}
		const cost = this.config.costs[file.file_type];

		// undefined file_types are free
		if (isUndefined(cost)) {
			logger.warn('[Quota.getCost] Undefined cost for file_type "%s".', file.file_type);
			file.cost = 0;
			return 0;
		}

		// split into objects
		const costObj: VpdbPlanCost = isObject(cost) ? cost as VpdbPlanCost : null;
		const costCategoryObj: VpdbPlanCategoryCost = costObj && isObject(costObj.category) ? costObj.category as VpdbPlanCategoryCost : null;

		// if a variation is demanded and cost contains variation def, ignore the rest.
		if (variation) {
			let variationCost:number;
			// EVERY VARIATION costs n credits. Example: { costs: { backglass: { variation: -1 } } }
			if (costObj) {
				if (!isUndefined(costObj.variation)) {
					variationCost = costObj.variation;
				} else {
					logger.warn('[Quota.getCost] No cost defined for %s file of variation %s and no fallback given, returning 0.', file.file_type, variation.name);
					variationCost = 0;
				}
			} else {
				logger.warn('[Quota.getCost] No cost defined for %s file of any variation returning default cost %s.', file.file_type, cost);
				variationCost = cost as number;
			}
			// save this for next time
			if (file.variations && file.variations[variation.name]) {
				file.variations[variation.name].cost = costObj.variation;
			}
			return variationCost;
		}

		// EVERY file (incl variation) costs n credits. Example: { costs: { rom: 0 } }
		if (!costObj) {
			file.cost = cost as number;
			return file.cost;
		}
		// ORIGINAL file costs n credits. Example: { costs: { logo: { category: 0 } } }
		if (!costCategoryObj) {
			if (!isUndefined(costObj.category)) {
				file.cost = costObj.category as number;
				return file.cost;

			} else {
				// warn if nothing is set, i.e the 'category' prop isn't defined but the original cost is still an object
				logger.warn('[Quota.getCost] No cost defined for %s file (type is undefined).', file.file_type, FileDocument.getMimeCategory(file, variation));
				file.cost = 0;
				return 0;
			}
		}
		// ORIGINAL file for a given mime type costs n credits. Example: { costs: { release: { category: { table: 1, '*': 0 } } } }
		const costCategory = costCategoryObj[FileDocument.getMimeCategory(file, variation)];
		if (!isUndefined(costCategory)) {
			file.cost = costCategory;
			return costCategory;
		}
		if (!isUndefined(costCategoryObj['*'])) {
			file.cost = costCategoryObj['*'];
			return costCategoryObj['*'];
		}
		logger.warn('[Quota.getCost] No cost defined for %s file of type %s and no fallback given, returning 0.', file.file_type, FileDocument.getMimeCategory(file, variation));
		file.cost = 0;
		return 0;
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
