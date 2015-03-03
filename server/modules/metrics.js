/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict";

var _ = require('lodash');
var bull = require('bull');
var redis = require('redis');
var async = require('async');
var logger = require('winston');

var Rating = require('mongoose').model('Rating');

var config = require('./settings').current;

var redisAtmKey = 'metrics:atm';

function Metrics() {

	this.entities = {
		game: require('mongoose').model('Game'),
		release: require('mongoose').model('Release')
	};

	// init redis
	this.redis = redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
	this.redis.select(config.vpdb.redis.db);
	this.redis.on('error', function(err) {
		logger.error('[metrics] Redis error: ' + err);
		logger.error(err.stack);
	});

	// init bull
	var redisOpts = {
		redis: {
			port: config.vpdb.redis.port,
			host: config.vpdb.redis.host,
			opts: {},
			DB: config.vpdb.redis.db
		}
	};
	this.queue = bull('metrics', redisOpts);
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
 * @param {function} callback Callback, run with (err, result), where result is returned from the API after voting
 */
Metrics.prototype.onRatingUpdated = function(ref, entity, rating, callback) {

	var that = this;

	// compute global mean first
	that.getGlobalMean(ref, assert(function(atm) {

		// then updatse entity metrics
		that.updateEntityMetrics(ref, entity, atm, assert(function(summary) {

			var result = { value: rating.value, created_at: rating.created_at };
			result[ref] = summary;

			var done = function(err) {
				if (err) {
					return callback(err);
				}
				callback(null, result);
			};

			// check if we need to re-compute ratings
			that.redis.get(redisAtmKey, assert(function(_atm) {
				if (!_atm) {
					// nothing set, update and go on.
					return that.updateGlobalMean(ref, atm, done);
				}

				var precision = 100;
				if (Math.round(_atm * precision) !== Math.round(atm * precision)) {
					logger.info('[metrics] Global mean of %ss changed from %s to %s, re-calculating bayesian estimages.', ref, Math.round(_atm * precision) / precision, Math.round(atm * precision) / precision);
					that.updateAllEntities(ref, atm, done);
				} else {
					done();
				}
			}, callback, 'Error reading atm from Redis.'));
		}, callback, 'Error updating entity metrics.'));
	}, callback, 'Error getting global mean.'));
};


/**
 * Re-calculates metrics for a given entity.
 *
 * @param {string} ref Reference to model
 * @param {object} entity Object that received the vote
 * @param {number} atm Arithmetic total mean
 * @param {function} callback Callback function, executed with (err, metrics)
 */
Metrics.prototype.updateEntityMetrics = function(ref, entity, atm, callback) {

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
	var m = config.vpdb.metrics.bayesianEstimate.minVotes;
	var am, n;

	// get arithmetic local mean
	var q = {};
	q['_ref.' + ref] = entity._id;
	Rating.aggregate({ $match: q }, {
		$group: {
			_id : null,
			sum: { $sum: '$value' },
			count: { $sum: 1 }
		}
	}, assert(function(result) {
		result = result[0];
		n = result.count;
		am = result.sum / n;

		var metrics = {
			average: Math.round(am * 1000) / 1000,
			votes: n,
			score: (n / (n + m)) * am + (m / (n + m)) * atm
		};

		entity.update({ rating: metrics }, function(err) {
			/* istanbul ignore if */
			if (err) {
				return callback(err);
			}
			callback(null, metrics);
		});
	}, callback, 'Error aggregating ratings for ' + JSON.stringify(q) + '.'));
};

Metrics.prototype.getGlobalMean = function(ref, callback) {

	// don't calculate if we use a hard-coded mean anyway.
	if (config.vpdb.metrics.bayesianEstimate.globalMean !== null) {
		return callback(null, config.vpdb.metrics.bayesianEstimate.globalMean);
	}

	var q = {};
	q['_ref.' + ref] = { '$ne': null };
	Rating.aggregate({ $match: q }, {
		$group: {
			_id : null,
			sum: { $sum: '$value' },
			count: { $sum: 1 }
		}
	}, assert(function(result) {
		result = result[0];
		callback(null, result.sum / result.count);
	}, callback));
};

Metrics.prototype.updateGlobalMean = function(ref, atm, callback) {
	this.redis.set(redisAtmKey, atm, function(err) {
		if (err) {
			return callback('Error updating global mean: ' + err.message);
		}
		callback();
	});
};

Metrics.prototype.updateAllEntities = function(ref, atm, callback) {

	var that = this;
	this.updateGlobalMean(ref, atm, assert(function() {

		var Model = that.entities[ref];
		if (!Model) {
			throw new Error('Model "' + ref + '" does not support ratings.');
		}

		// update all entities that have at least one rating
		Model.find({ 'rating.votes': { '$gt': 0 } }, assert(function(entities) {
			logger.log('[metrics] Updating metrics for %d %ss...', entities.length, ref);
			async.eachSeries(entities, function(entity, next) {
				that.updateEntityMetrics(ref, entity, atm, next);
			}, callback);

		}, callback, 'Error finding rated ' + ref + 's.'));
	}, callback, 'Error updating global mean.'));
};


function assert(success, failure, message) {
	return function(err, result) {
		/* istanbul ignore if */
		if (err) {
			if (message) {
				logger.error('ERROR: ' + message);
			}
			return failure(err);
		}
		success(result);
	};
}

module.exports = new Metrics();