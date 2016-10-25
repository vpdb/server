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
	}

	/**
	 * Updates all games with Pinside's top 100 rankings.
	 * @param {{ top300:boolean }} [opts] Options
	 * @return {Promise}
	 */
	updateTop100(opts) {
		opts = opts || {};
		return this.getTop100(opts).then(top100 => {
			return Promise.each(top100, pinsideGame => {
				const strip = /\(([^)]+)\)|[^a-z0-9]+$/gi;
				const regex = new RegExp(pinsideGame.title.replace(strip, '').replace(/[^a-z0-9]+/gi, '.*?'), 'i');
				return Game.find({ title: { $regex: regex } }).exec().then(matchedGames => {
					// +-2 years is okay
					matchedGames = matchedGames.filter(g => Math.abs(pinsideGame.year - g.year) < 3);
					if (matchedGames.length === 0) {
						console.log('No match for %s', pinsideGame.title);
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

						return g.save();
					} else {
						console.log('Found multiple games %s.', matchedGames.map(g => `${g.title} (${g.manufacturer} ${g.year})`).join(', '));
					}
				});
			});
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