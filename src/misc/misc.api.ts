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

import { extend } from 'lodash';

import { Api } from '../common/api';
import { logger } from '../common/logger';
import { config } from '../common/settings';
import { Context } from '../common/types/context';
import { gitInfo } from '../common/gitinfo';
import { ipdb } from '../common/ipdb';
import { roles } from '../common/acl';
import { processorQueue } from '../files/processor/processor.queue';
import { apiCache } from '../common/api.cache';

const pak = require('../../package.json');

export class MiscApi extends Api {

	/**
	 * The root URL of the API. Returns app version and revision.
	 *
	 * @see GET /v1
	 * @param {Application.Context} ctx Koa context
	 */
	public async index(ctx: Context) {

		const result = {
			app_name: config.vpdb.name,
			app_version: pak.version,
			app_date: gitInfo.hasInfo() ? gitInfo.getLastCommit().lastCommitTime : undefined,
			app_sha: gitInfo.hasInfo() ? gitInfo.getLastCommit().SHA : undefined
		};
		return this.success(ctx, result, 200);
	}

	/**
	 * Retrieves metadata from IPDB.org.
	 *
	 * @see GET /v1/ipdb/:id
	 * @param {Context} ctx Koa context
	 */
	public async ipdbDetails(ctx: Context) {
		const game = await ipdb.details(ctx.params.id, { offline: ctx.query.dryrun });
		return this.success(ctx, game);
	}

	/**
	 * Returns all available ACL roles.
	 *
	 * @see GET /v1/roles
	 * @param {Application.Context} ctx Koa context
	 */
	public async roles(ctx: Context) {
		return this.success(ctx, roles, 200);
	}

	/**
	 * Returns all available plans
	 *
	 * @see GET /v1/plans
	 * @param {Application.Context} ctx Koa context
	 */
	public async plans(ctx: Context) {
		const plans:any[] = [];
		config.vpdb.quota.plans.forEach(plan => {
			plans.push(extend(plan, { name: plan.name || plan.id, is_default: plan.id === config.vpdb.quota.defaultPlan }));
		});
		return this.success(ctx, plans, 200);
	}

	/**
	 * Returns a ping.
	 *
	 * @see GET /v1/ping
	 * @param {Application.Context} ctx Koa context
	 */
	public async ping(ctx: Context) {
		return this.success(ctx, { result: 'pong' }, 200);
	}

	/**
	 * Clears the API cache.
	 *
	 * @param {Context} ctx Koa context
	 * @return {Promise<boolean>} Number of caches cleared
	 */
	public async invalidateCache(ctx: Context) {
		const num = await apiCache.invalidateAll();
		logger.info("[MiscApi.invalidateCache] Cleared %s caches.", num);
		return this.success(ctx, { cleared: num });
	}

	/**
	 * Terminates the server.
	 *
	 * @see POST /v1/kill
	 * @param {Application.Context} ctx Koa context
	 */
	public async kill(ctx: Context) {

		// send response
		this.success(ctx, { result: 'shutting down.' }, 200);

		// wait for jobs to finish
		processorQueue.waitForLastJob().then(() => {
			// and off we go.
			logger.wtf('[MiscApi] Shutting down.');
			setTimeout(() => process.exit(0), 500);
		});
	}
}