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

"use strict";

const _ = require('lodash');
const cheerio = require('cheerio');
const logger = require('winston');
const request = require('request');
const basename = require('path').basename;

const Game = require('mongoose').model('Game');

class Pinside {

	constructor() {
		this._error = require('./error')('pinside');
		this._mapping = {
			'batman-the-dark-knight': 5307,
			'spider-man-vault': 5237,
			'black-spider-man': 5237,
			'iron-man-ve': 5550,
			'star_trek': 6044,
			'star_trek_le': 6044,
			'star-trek-the-mirror-universe': 2355,
			'star-trek': 2355,
			'star-trek-the-next-generation': 2357,
			'star-trek-dataeast': 2356,
			'lord-of-the-rings-(le)': 4858,
			'ghostbuster-premium-le': 6332,
			'ghostbusters': 6332,
			'wizard-of-oz': 5800,
			'the_walking_dead_le': 6155,
			'addams-family-gold-special-collectors-edition': 20,
			'the-hobbit': 6224,
			'game-of-thrones-le': 6307,
			'x-men-le': 5822,
			'revenge-from-mars': 4446,
			'transformers-(le)': 5709,
			'eight-ball-deluxe-limited-edition': 762,
			'flash-gordon': 874,
			'flash': 871,
			'csi': 5348,
			'back-to-the-future': 126,
			'the-avengers': 5938,
			'centaur-ii': 476
		};
	}

	/**
	 * Updates all games with Pinside's top 100 rankings.
	 * @param {{ top300:boolean }} [opts] Options
	 * @return {Promise}
	 */
	updateTop100(opts) {
		opts = opts || {};
		let result = {
			matched: 0,
			missed: 0,
			double: 0
		};
		let top100;
		return this.getTop100(opts).then(result => {
			top100 = result;
			// reset all ranks
			return Game.update({}, { 'pinside.ranks': [] });

		}).then(() => {
			return Promise.each(top100, pinsideGame => {
				const strip = /\(([^)]+)\)|[^a-z0-9]+$/gi;
				const regex = new RegExp(pinsideGame.title.replace(strip, '').replace(/[^a-z0-9]+/gi, '.*?'), 'i');
				let mapped = false;
				let query;
				if (this._mapping[pinsideGame.id]) {
					mapped = true;
					query = { 'ipdb.number': this._mapping[pinsideGame.id] };
				} else {
					query = { title: { $regex: regex } };
				}
				return Game.find(query).exec().then(matchedGames => {
					if (!mapped) {
						// +-2 years is okay
						matchedGames = matchedGames.filter(g => Math.abs(pinsideGame.year - g.year) < 3);
					}
					if (matchedGames.length === 0) {
						console.log('No match for %s (%s %s): %s', pinsideGame.title, pinsideGame.mfg, pinsideGame.year, pinsideGame.id);
						result.missed++;

					} else if (matchedGames.length === 1) {
						const g = matchedGames[0];
						console.log('Found game: %s (%s %s): %s', g.title, g.manufacturer, g.year, pinsideGame.id);
						g.pinside = g.pinside || [];
						g.pinside.ids = g.pinside.ids || [];
						g.pinside.ranks = g.pinside.ranks || [];
						g.pinside.ids.push(pinsideGame.id);
						g.pinside.ranks.push(pinsideGame.rank);
						g.pinside.rating = pinsideGame.rating;
						g.pinside.ids = _.uniq(g.pinside.ids);
						g.pinside.ranks = _.uniq(g.pinside.ranks);
						result.matched++;
						return g.save();

					} else {
						console.log('Found multiple games %s.', matchedGames.map(g => `${g.title} (${g.manufacturer} ${g.year})`).join(', '));
						result.double++;
					}
				});
			}).then(() => result);
		});
	}

	/**
	 * Returns a list of Pinside's current top 100.
	 * @param {{ top300:boolean }} [opts] Options
	 * @return {Promise.<{rank:number, title:string, url:string, id:string, year:number, mfg:string, rating:number}>} List of games
	 */
	getTop100(opts) {
		opts = opts || {};
		return Promise.try(() => {
			const urls = ['https://pinside.com/pinball/top-100'];
			if (opts.top300) {
				urls.push('https://pinside.com/pinball/top-100/2');
				urls.push('https://pinside.com/pinball/top-100/3');
			}
			return Promise.mapSeries(urls, url => {
				return this._fetchUrl(url).then($ => {
					return $('.top-100-entry').map((i, el) => {
						let mfgYear = $(el).find('.top-100-entry-meta-left').text().trim().split(/,\s+/);
						return {
							rank: parseInt($(el).find('.top-100-entry-num').text().trim()),
							title: $(el).find('.top-100-entry-title a').text().trim(),
							url: 'https://pinside.com' + $(el).find('.top-100-entry-title a').attr('href').trim(),
							id: basename($(el).find('.top-100-entry-title a').attr('href').trim()),
							mfg: mfgYear[0].trim(),
							year: parseInt(mfgYear[1]),
							rating: parseFloat($(el).find('.top-100-entry-sco').text().trim())
						};
					}).get();
				});
			}).then(lists => {
				return _.flatten(lists);
			});
		});
	}

	/**
	 *
	 * @param {string} url URL to fetch
	 * @param {number} [expectedResult=200]
	 * @return Promise.<string>
	 * @private
	 */
	_fetchUrl(url, expectedResult) {
		expectedResult = expectedResult || 200;
		return Promise.try(() => {
			logger.info('[pinside] Fetching %s', url);
			return new Promise((resolve, reject) => {
				request({ url: url, timeout: 30000 }, function(err, response, body) {
					/* istanbul ignore if */
					if (!response) {
						throw this._error('Timeout while trying to reach pinside.com. Please try again later.').log();
					}
					/* istanbul ignore if */
					if (err) {
						return reject(err);
					}
					resolve([response, body]);
				});
			});

		}).spread((response, body) => {
			/* istanbul ignore if */
			if (response.statusCode !== expectedResult) {
				logger.error('[pinside] Wrong response code, got %s instead of %s. Body: %s', response.statusCode, expectedResult, body);
				throw this._error('Wrong response data from Pinside.').log();
			}
			return cheerio.load(body);
		});
	}
}

module.exports = new Pinside();