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

import { state } from '../state';
import { logger } from './logger';
import { Document, Model } from 'mongoose';
import { Rating } from '../ratings/rating';
import { config } from './settings';


class Metrics {

	private readonly redisAtmKey = 'metrics:atm';
	private readonly entities: { [key: string]: Model<Document> } = {
		game: state.models.Game,
		release: state.models.Release
	};

	/**
	 * Updates the rating with the average, count and score.
	 *
	 * If needed, runs through other ratings as well, if global arithmetic mean
	 * changed.
	 *
	 * @param {string} ref Reference to model
	 * @param {object} entity Object that received the vote
	 * @param {object} rating Rating object
	 * @reuturn {Promise.<{}>} Result
	 */
	public async onRatingUpdated(ref: string, entity: Document, rating: Rating) {

		const atm = await this.getGlobalMean(ref);
		const summary = await this.updateEntityMetrics(ref, entity, atm);
		const result = {
			value: rating.value,
			created_at: rating.created_at,
			[ref]: summary
		};
		const _atm = parseInt(await state.redis.getAsync(this.redisAtmKey));
		const precision = 100;
		if (!_atm) {
			// nothing set, update and go on.
			await this.updateGlobalMean(atm);
		} else if (Math.round(_atm * precision) !== Math.round(atm * precision)) {
			logger.info('[metrics] Global mean of %ss changed from %s to %s, re-calculating bayesian estimages.', ref, Math.round(_atm * precision) / precision, Math.round(atm * precision) / precision);
			await this.updateAllEntities(ref, atm);
		}
		return result;
	}

	/**
	 * Re-calculates metrics for a given entity.
	 *
	 * @private
	 * @param {string} ref Reference to model
	 * @param {object} entity Object that received the vote
	 * @param {number} atm Arithmetic total mean
	 * @return Promise<{ average: number, votes: number, score: number }>
	 */
	private async updateEntityMetrics(ref: string, entity: Document, atm: number): Promise<{ average: number, votes: number, score: number }> {

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
		let m = config.vpdb.metrics.bayesianEstimate.minVotes;
		let am, n;

		// get arithmetic local mean
		let q = { ['_ref.' + ref]: entity._id };
		let metrics;

		// Mongoose API FTW!!
		const results = await new Promise<any[]>((resolve, reject) => {
			let data: any[] = [];
			return state.models.Rating.aggregate([{ $match: q }, {
				$group: {
					_id: null,
					sum: { $sum: '$value' },
					count: { $sum: 1 }
				}
			}])
				.cursor({})
				.exec()
				.on('data', (doc: any) => data.push(doc))
				.on('end', () => resolve(data))
				.on('error', reject);
		});

		const result: any = results[0];
		n = result.count;
		am = result.sum / n;

		metrics = {
			average: Math.round(am * 1000) / 1000,
			votes: n,
			score: (n / (n + m)) * am + (m / (n + m)) * atm
		};
		await entity.update({ rating: metrics });
		return metrics;
	}

	private async getGlobalMean(ref: string): Promise<number> {

		/* istanbul ignore if: don't calculate if we use a hard-coded mean anyway. */
		if (config.vpdb.metrics.bayesianEstimate.globalMean !== null) {
			return Promise.resolve(config.vpdb.metrics.bayesianEstimate.globalMean);
		}
		let q: any = { ['_ref.' + ref]: { '$ne': null } };

		// Mongoose API FTW!!
		const results = await new Promise<any[]>((resolve, reject) => {
			let data: any[] = [];
			return state.models.Rating.aggregate([{ $match: q }, {
				$group: {
					_id: null,
					sum: { $sum: '$value' },
					count: { $sum: 1 }
				}
			}])
				.cursor({})
				.exec()
				.on('data', (doc: any) => data.push(doc))
				.on('end', () => resolve(data))
				.on('error', reject);
		});
		return results[0].sum / results[0].count;
	}

	private async updateGlobalMean(atm: any) {
		return state.redis.setAsync(this.redisAtmKey, atm);
	};

	private async updateAllEntities(ref: string, atm: number) {

		await this.updateGlobalMean(atm);
		const model: Model<Document> = this.entities[ref];

		/* istanbul ignore if */
		if (!model) {
			throw new Error('Model "' + ref + '" does not support ratings.');
		}

		// update all entities that have at least one rating
		const entities = await model.find({ 'rating.votes': { '$gt': 0 } }).exec();
		logger.info('[metrics] Updating metrics for %d %ss...', entities.length, ref);

		for (const entity of entities) {
			await this.updateEntityMetrics(ref, entity, atm);
		}
	}
}

export const metrics = new Metrics();