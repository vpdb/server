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

var minVotes = 10;

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
 * @param {object} user User who voted
 * @param {function} callback Callback, run with (err, result), where result is returned from the API after voting
 */
Metrics.prototype.updateRatedEntity = function(ref, entity, rating, user, callback) {

	var Model = this.entities[ref];
	if (!Model) {
		throw new Error('Model "' + ref + '" does not support ratings.');
	}

	var assert = function(next, callback, message) {
		return function(err, result) {
			/* istanbul ignore if */
			if (err) {
				if (message) {
					logger.error('ERROR: ' + message);
				}
				return next(err);
			}
			callback(result);
		};
	};

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

	var that = this;
	var m = minVotes;
	var am, n, atm;

	async.series([

		// get arithmetic local mean
		function(next) {
			var q = {};
			q['_ref.' + ref] = entity._id;
			Rating.aggregate({ $match: q }, {
				$group: {
					_id : null,
					sum: { $sum: '$value' },
					count: { $sum: 1 }
				}
			}, assert(next, function(result) {
				result = result[0];
				n = result.count;
				am = result.sum / n;
				next();
			}, 'Error summing ratings for ' + JSON.stringify(q) + '.'));
		},

		// get arithmetic global mean
		function(next) {
			that.redis.get(redisAtmKey, assert(next, function(_atm) {
				if (_atm) {
					atm = _atm;

					// TODO: check if atm changed, and if so, re-calculate ratings.
					return next();
				}

				// unknown global mean, let's count then.
				var q = {};
				q['_ref.' + ref] = { '$ne': null };
				Rating.aggregate({ $match: q }, {
					$group: {
						_id : null,
						sum: { $sum: '$value' },
						count: { $sum: 1 }
					}
				}, assert(next, function(result) {
					result = result[0];
					atm = result.sum / result.count;

					//that.redis.set(redisAtmKey, atm, next);
					next();

				}, 'Error summing global ratings for ' + JSON.stringify(q) + '.'));
			}, 'Error reading atm from Redis.'));
		}

	], function(err) {
		if (err) {
			logger.error('Error computing bayesian estimate: ' + err.message);
			logger.error(err.stack);
			return callback(err);
		}

		logger.info('  --- count = %d', n);
		logger.info('  --- mean = %s', am);
		logger.info('  --- global mean = %s', atm);

		var summary = {
			average: Math.round(am * 1000) / 1000,
			votes: n,
			score: (n / (n + m)) * am + (m / (n + m)) * atm
		};

		entity.update({ rating: summary }, function(err) {

			/* istanbul ignore if */
			if (err) {
				return callback(err);
			}

			var result = { value: rating.value, created_at: rating.created_at };
			result[ref] = summary;

			callback(null, result);
		});
	});

};

module.exports = new Metrics();