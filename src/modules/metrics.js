/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const redis = require('redis');
const logger = require('winston');

const Rating = require('mongoose').model('Rating');
const config = require('./settings').current;
const redisAtmKey = 'metrics:atm';

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

function Metrics() {

	this.entities = {
		game: require('mongoose').model('Game'),
		release: require('mongoose').model('Release')
	};

	// init redis
	this.redis = redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
	this.redis.select(config.vpdb.redis.db);
	this.redis.on('error', /* istanbul ignore next */ function(err) {
		logger.error('[metrics] Redis error: ' + err);
		logger.error(err.stack);
	});
}

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
Metrics.prototype.onRatingUpdated = function(ref, entity, rating) {

	let atm, result;
	return Promise.try(() => {
		return this._getGlobalMean(ref);

	}).then(res => {
		atm = res;
		return this._updateEntityMetrics(ref, entity, atm);

	}).then(summary => {
		result = {
			value: rating.value,
			created_at: rating.created_at,
			[ref]: summary
		};
		return this.redis.getAsync(redisAtmKey);

	}).then(_atm => {

		if (!_atm) {
			// nothing set, update and go on.
			return this._updateGlobalMean(ref, atm);
		}
		const precision = 100;
		if (Math.round(_atm * precision) !== Math.round(atm * precision)) {
			logger.info('[metrics] Global mean of %ss changed from %s to %s, re-calculating bayesian estimages.', ref, Math.round(_atm * precision) / precision, Math.round(atm * precision) / precision);
			return this._updateAllEntities(ref, atm);
		}
		return null;

	}).then(() => result);
};


/**
 * Re-calculates metrics for a given entity.
 *
 * @private
 * @param {string} ref Reference to model
 * @param {object} entity Object that received the vote
 * @param {number} atm Arithmetic total mean
 * @return Promise.<{}>
 */
Metrics.prototype._updateEntityMetrics = function(ref, entity, atm) {

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

	return Promise.try(() => {

		// Mongoose API FTW!!
		return new Promise((res, rej) => {
			let data = [];
			return Rating.aggregate({ $match: q }, {
				$group: {
					_id: null,
					sum: { $sum: '$value' },
					count: { $sum: 1 }
				}
			})
			.cursor({})
			.exec()
			.on('data', doc => data.push(doc))
			.on('end', () => res(data))
			.on('error', rej);
		});

	}).then(result => {
		result = result[0];
		n = result.count;
		am = result.sum / n;

		metrics = {
			average: Math.round(am * 1000) / 1000,
			votes: n,
			score: (n / (n + m)) * am + (m / (n + m)) * atm
		};
		return entity.update({ rating: metrics });

	}).then(() => metrics);
};

Metrics.prototype._getGlobalMean = function(ref) {

	/* istanbul ignore if: don't calculate if we use a hard-coded mean anyway. */
	if (config.vpdb.metrics.bayesianEstimate.globalMean !== null) {
		return Promise.resolve(config.vpdb.metrics.bayesianEstimate.globalMean);
	}
	return Promise.try(() => {
		let q = { ['_ref.' + ref]: { '$ne': null } };

		// Mongoose API FTW!!
		return new Promise((res, rej) => {
			let data = [];
			return Rating.aggregate({ $match: q }, {
				$group: {
					_id: null,
					sum: { $sum: '$value' },
					count: { $sum: 1 }
				}
			})
			.cursor({})
			.exec()
			.on('data', doc => data.push(doc))
			.on('end', () => res(data))
			.on('error', rej);
		});

	}).then(result => result[0].sum / result[0].count);
};

Metrics.prototype._updateGlobalMean = function(ref, atm) {
	return this.redis.setAsync(redisAtmKey, atm);
};

Metrics.prototype._updateAllEntities = function(ref, atm) {

	return Promise.try(() => {
		return this._updateGlobalMean(ref, atm);

	}).then(() => {
		const Model = this.entities[ ref ];

		/* istanbul ignore if */
		if (!Model) {
			throw new Error('Model "' + ref + '" does not support ratings.');
		}

		// update all entities that have at least one rating
		return Model.find({ 'rating.votes': { '$gt': 0 } }).exec();

	}).then(entities => {
		logger.log('[metrics] Updating metrics for %d %ss...', entities.length, ref);
		return Promise.each(entities, entity => this._updateEntityMetrics(ref, entity, atm));

	});
};

module.exports = new Metrics();