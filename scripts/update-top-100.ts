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

/* tslint:disable:no-console object-literal-key-quotes member-ordering */
import axios from 'axios';
import cheerio from 'cheerio';
import { uniq } from 'lodash';
import mongoose from 'mongoose';
import { basename } from 'path';
import { endPoints } from '../src/common/api.endpoints';
import { logger } from '../src/common/logger';
import { config } from '../src/common/settings';
import { state } from '../src/state';

(async () => {

	try {

		await bootstrapDatabase();

		// update from Pinside
		const pinside = new Pinside();
		const result = await pinside.updateTop100({ top300: true });

		const total = result.matched + result.missed + result.double;
		console.log('Total: %d', total);
		console.log('Matched: %d (%d%)', result.matched, Math.round(result.matched / total * 100));
		console.log('Missed: %d (%d%)', result.missed, Math.round(result.missed / total * 100));
		console.log('Double: %d (%d%)', result.double, Math.round(result.double / total * 100));

	} catch (err) {
		console.error('Migration error.');
		console.error(err.stack);

	} finally {
		await closeDatabase();
		process.exit(0);
	}
})();

class Pinside {

	/**
	 * Updates all games with Pinside's top 100 rankings.
	 * @param {{ top300:boolean }} [opts] Options
	 * @param {boolean} [opts.top300] If set, fetch top 300 instead of top 100.
	 * @return {Promise}
	 */
	public async updateTop100(opts: { top300?: boolean } = {}): Promise<{ matched: number, missed: number, double: number }> {
		const result = {
			matched: 0,
			missed: 0,
			double: 0,
		};
		const top100 = await this.getTop100(opts);

		// reset all ranks
		await state.models.Game.update({}, { 'pinside.ranks': [] }).exec();
		for (const pinsideGame of top100) {

			const strip = /\(([^)]+)\)|[^a-z0-9]+$/gi;
			const regex = new RegExp(pinsideGame.title.replace(strip, '').replace(/[^a-z0-9]+/gi, '.*?'), 'i');
			let mapped = false;
			let query;
			if (this.mapping[pinsideGame.id]) {
				mapped = true;
				query = { 'ipdb.number': this.mapping[pinsideGame.id] };
			} else {
				query = { title: { $regex: regex } };
			}
			let matchedGames = await state.models.Game.find(query).exec();
			if (!mapped) {
				// +-2 years is okay
				matchedGames = matchedGames.filter(g => Math.abs(pinsideGame.year - g.year) < 3);
			}
			if (matchedGames.length === 0) {
				logger.info(null, '[Pinside.updateTop100] No match for %s (%s %s): %s', pinsideGame.title, pinsideGame.mfg, pinsideGame.year, pinsideGame.id);
				result.missed++;

			} else if (matchedGames.length === 1) {
				const matchedGame = matchedGames[0];
				logger.info(null, '[Pinside.updateTop100] Found game: %s (%s %s): %s', matchedGame.title, matchedGame.manufacturer, matchedGame.year, pinsideGame.id);
				matchedGame.pinside = matchedGame.pinside || {};
				matchedGame.pinside.ids = matchedGame.pinside.ids || [];
				matchedGame.pinside.ranks = matchedGame.pinside.ranks || [];
				matchedGame.pinside.ids.push(pinsideGame.id);
				matchedGame.pinside.ranks.push(pinsideGame.rank);
				matchedGame.pinside.rating = pinsideGame.rating;
				matchedGame.pinside.ids = uniq(matchedGame.pinside.ids);
				matchedGame.pinside.ranks = uniq(matchedGame.pinside.ranks);
				result.matched++;
				await matchedGame.save();

			} else {
				logger.info(null, '[Pinside.updateTop100] Found multiple games %s.', matchedGames.map(g => `${g.title} (${g.manufacturer} ${g.year})`).join(', '));
				result.double++;
			}
		}
		return result;
	}

	private async getTop100(opts: { top300?: boolean } = {}): Promise<PinsideGame[]> {
		const urls = ['https://pinside.com/pinball/top-100'];
		if (opts.top300) {
			urls.push('https://pinside.com/pinball/top-100/2');
			urls.push('https://pinside.com/pinball/top-100/3');
		}
		const games: PinsideGame[] = [];
		for (const url of urls) {
			const $ = await this.fetchUrl(url);
			games.push(...this.parseGames($));
		}
		return games;
	}

	private parseGames($: any): PinsideGame[] {
		return $('.top-100-group-inner > .top-100-entry').map((i: any, el: any) => {

			let mfgYear: [string, number];
			const sublist = $(el).find('.top-100-entry-sublist');
			if (sublist.length > 0) {
				mfgYear = Array.from($(sublist).find('.top-100-entry-meta-left'))
					.map(e => $(e).text().trim())
					.map(v => v.split(','))
					.map(v => [ v[0].trim(), parseInt(v[1].trim(), 10) ] as [string, number])
					.sort((a, b) => a[1] > b[1] ? 1 : -1)
					[0];
			} else {
				const v = $(el).find('.top-100-entry-meta-left').text().trim().split(/,\s+/);
				mfgYear = [ v[0].trim(), parseInt(v[1].trim(), 10)];
			}
			const titleLinkEl =  $(el).find('> div > .top-100-entry-title a');
			return {
				rank: parseInt($(el).find('> div > .top-100-entry-num').text().trim(), 10),
				title: titleLinkEl.text().trim().replace(/\s+\(\d+\)$/, ''),
				url: 'https://pinside.com' + titleLinkEl.attr('href').trim(),
				id: basename(titleLinkEl.attr('href').trim()),
				mfg: mfgYear[0],
				year: mfgYear[1],
				rating: parseFloat($(el).find('> div > .top-100-entry-sco').text().trim()),
			};
		}).get();
	}

	private async fetchUrl(url: string) {
		logger.info(null, '[Pinside.fetchUrl] Fetching %s', url);
		const response = await axios.get(url, { timeout: 30000 });
		return cheerio.load(response.data);
	}

	private mapping: { [key: string]: number } = {
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
		'centaur-ii': 476,
		'adventures-of-rocky-and-bullwinkle-and-friends': 23,
	};
}

interface PinsideGame {
	rank: number;
	title: string;
	url: string;
	id: string;
	year: number;
	mfg: string;
	rating: number;
}

async function bootstrapDatabase() {
	await mongoose.connect(config.vpdb.db, { useNewUrlParser: true });
	for (const endPoint of endPoints) {
		endPoint.registerModel();
	}
}

async function closeDatabase() {
	await mongoose.connection.close();
}
