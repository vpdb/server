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

import { Document, Model } from 'mongoose';
import { Rating } from '../ratings/rating';
import { state } from '../state';
import { apiCache } from './api.cache';
import { logger } from './logger';
import { config } from './settings';

class Metrics {

	private readonly redisAtmKey = 'metrics:atm';

	/**
	 * Updates the rating with the average, count and score.
	 *
	 * If needed, runs through other ratings as well, if global arithmetic mean
	 * changed.
	 *
	 * @param {string} modelName Reference to model, e.g. "release"
	 * @param {object} entity Object that received the vote
	 * @param {object} rating Rating object
	 * @reuturn {Promise.<{}>} Result
	 */
	public async onRatingUpdated(modelName: string, entity: Document, rating: Rating) {

		const atm = await this.getGlobalMean(modelName);
		const summary = await this.updateEntityMetrics(modelName, entity, atm);
		const _atm = parseInt(await state.redis.get(this.redisAtmKey));
		const precision = 100;
		if (!_atm) {
			// nothing set, update and go on.
			await this.updateGlobalMean(atm);

		} else if (Math.round(_atm * precision) !== Math.round(atm * precision)) {
			logger.info('[Metrics.onRatingUpdated] Global mean of %ss changed from %s to %s, re-calculating bayesian estimates.', modelName, Math.round(_atm * precision) / precision, Math.round(atm * precision) / precision);
			await this.updateAllEntities(modelName, atm);
			await apiCache.invalidateAllEntities(modelName);
		}
		return {
			value: rating ? rating.value : 0,
			created_at: rating ? rating.created_at : undefined,
			[modelName]: summary,
		};
	}

	/**
	 * Re-calculates metrics for a given entity.
	 *
	 * @private
	 * @param {string} modelName Reference to model
	 * @param {object} entity Object that received the vote
	 * @param {number} atm Arithmetic total mean
	 * @return Promise<{ average: number, votes: number, score: number }>
	 */
	private async updateEntityMetrics(modelName: string, entity: Document, atm: number): Promise<{ average: number, votes: number, score: number }> {

		/*
		 * Bayesian estimate:
		 * Score Ws = (N / (N + m)) × Am + (m / (N + m)) × ATm
		 *
		 * Where:
		 *    Am = arithmetic mean for the item
		 *    N = total number of votes
		 *    m = minimum number of votes for the item to be taken into account
		 *    ATm = arithmetic total mean when considering the collection of all the items
		 */
		const m = config.vpdb.metrics.bayesianEstimate.minVotes;
		let am, n;

		// get arithmetic local mean
		const q = { ['_ref.' + modelName]: entity._id };
		let metrics;

		const results = await this.aggregate(q);

		if (results.length === 1) {
			const result: any = results[0];
			n = result.count;
			am = result.sum / n;
			metrics = {
				average: Math.round(am * 1000) / 1000,
				votes: n,
				score: (n / (n + m)) * am + (m / (n + m)) * atm,
			};
		} else {
			metrics = { average: 0, votes: 0, score: 0 };
		}

		await entity.update({ rating: metrics });

		// invalidate cache
		await apiCache.invalidateEntity(modelName, entity.id);

		return metrics;
	}

	private async getGlobalMean(modelName: string): Promise<number> {

		/* istanbul ignore if: don't calculate if we use a hard-coded mean anyway. */
		if (config.vpdb.metrics.bayesianEstimate.globalMean !== null) {
			return Promise.resolve(config.vpdb.metrics.bayesianEstimate.globalMean);
		}
		const q: any = { ['_ref.' + modelName]: { $ne: null } };

		const results = await this.aggregate(q);
		if (results.length === 1) {
			return results[0].sum / results[0].count;
		} else {
			logger.warn('[Metrics.getGlobalMean] No entities found for %s, returning 0.', modelName);
			return 0;
		}

	}

	private async updateGlobalMean(atm: any) {
		return state.redis.set(this.redisAtmKey, atm);
	}

	private async updateAllEntities(modelName: string, atm: number) {

		await this.updateGlobalMean(atm);
		const model = state.getModel(modelName);

		/* istanbul ignore if */
		if (!model) {
			throw new Error('Model "' + modelName + '" does not support ratings.');
		}

		// update all entities that have at least one rating
		const entities = await model.find({ 'rating.votes': { $gt: 0 } }).exec();
		logger.info('[Metrics.updateAllEntities] Updating metrics for %d %ss...', entities.length, modelName);

		for (const entity of entities) {
			await this.updateEntityMetrics(modelName, entity, atm);
		}
	}

	private async aggregate(q: any) {
		// Mongoose API FTW!!
		return new Promise<any[]>((resolve, reject) => {
			const data: any[] = [];
			return state.models.Rating.aggregate([{ $match: q }, {
				$group: {
					_id: null,
					sum: { $sum: '$value' },
					count: { $sum: 1 },
				},
			}])
				.cursor({})
				.exec()
				.on('data', (doc: any) => data.push(doc))
				.on('end', () => resolve(data))
				.on('error', reject);
		});
	}
}

export const metrics = new Metrics();
