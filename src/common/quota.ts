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

import Bluebird = require('bluebird');
import { isArray, isObject, isUndefined } from 'lodash';
import { VpdbQuotaConfig } from './types/config';
import { User } from '../users/user';
import { Context } from 'context';
import { ApiError } from './api.error';
import { config } from './settings';
import { logger } from './logger';
import { File} from '../files/file';
import { FileVariation } from '../files/file.variations';
import { FileDocument } from '../files/file.document';

const quotaModule = require('volos-quota-redis');

export class Quota {

	private readonly config: VpdbQuotaConfig = config.vpdb.quota;
	private readonly quota: { [key: string]: any } = {};

	/**
	 * Initializes quota plans
	 */
	constructor() {
		logger.info('[Quota] Initializing quotas...');
		let duration;

		// we create a quota module for each duration
		this.config.plans.forEach(plan => {
			if (plan.unlimited === true) {
				logger.info('[Quota] Skipping unlimited plan "%s".', plan.id);
				return;
			}
			duration = plan.per;
			if (!this.quota[duration]) {
				logger.info('[Quota] Setting up quota per %s for plan %s...', duration, plan.id);
				this.quota[duration] = quotaModule.create({
					timeUnit: duration,
					interval: 1,
					host: config.vpdb.redis.host,
					port: config.vpdb.redis.port,
					db: config.vpdb.redis.db
				});
				Bluebird.promisifyAll(this.quota[duration]);
			} else {
				logger.info('[Quota] Not setting up plan %s because volos needs setups per duration and we already set up per %s.', plan.id, duration);
			}
		});
	}

	/**
	 * Returns the current rate limits for the given user.
	 *
	 * @param {User} user User
	 * @return {Promise<UserQuota>} Remaining quota
	 */
	public async getCurrent(user: User): Promise<UserQuota> {

		let plan = user.planConfig;
		if (!plan) {
			throw new ApiError('Unable to find plan "%s" for user.', user._plan);
		}

		// unlimited?
		if (plan.unlimited === true) {
			return { unlimited: true, limit: 0, period: 'never', remaining: 0, reset: 0 };
		}
		// TODO fix when fixed: https://github.com/apigee-127/volos/issues/33
		await this.quota[plan.per].applyAsync({
			identifier: user.id,
			weight: -2,
			allow: plan.credits
		});
		const result = await this.quota[plan.per].applyAsync({
			identifier: user.id,
			weight: 2,
			allow: plan.credits
		});
		return {
			unlimited: false,
			period: plan.per,
			limit: result.allowed,
			remaining: result.allowed - result.used,
			reset: result.expiryTime
		};
	}

	/**
	 * Checks if there is enough quota for the given file and consumes the quota.
	 * It also adds the rate limit headers to the request.
	 *
	 * @param {Context} ctx Koa context
	 * @param {File[]} files File(s) to check for
	 * @return {Promise<boolean>} True if allowed, false otherwise.
	 */
	public async isAllowed(ctx: Context, files: File | File[]): Promise<boolean> {

		if (!isArray(files)) {
			files = [files];
		}

		// deny access to anon (wouldn't be here if there were only free files)
		if (!ctx.state.user) {
			return false;
		}

		const plan = ctx.state.user.planConfig;
		if (!plan) {
			throw new ApiError('No quota defined for plan "%s"', ctx.state.user._plan);
		}

		// allow unlimited plans
		if (plan.unlimited === true) {
			return true;
		}

		const sum = this.getTotalCost(files);

		// don't even check quota if weight is 0
		if (sum === 0) {
			return true;
		}

		// https://github.com/apigee-127/volos/tree/master/quota/common#quotaapplyoptions-callback
		const result = await this.quota[plan.per].applyAsync({
			identifier: ctx.state.user.id,
			weight: sum,
			allow: plan.credits
		});

		ctx.response.set({
			'X-RateLimit-Limit': String(result.allowed),
			'X-RateLimit-Remaining': String(result.allowed - result.used),
			'X-RateLimit-Reset': result.expiryTime
		});
		return result.isAllowed;
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
	unlimited: boolean;
	period: string;
	limit: number;
	remaining: number;
	reset: number
}

export const quota = new Quota();
