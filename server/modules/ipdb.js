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
var ent = require('ent');
var logger = require('winston');
var request = require('request');

var error = require('./error')('ipdb');

function Ipdb() {
}

Ipdb.prototype.details = function(ipdbNo, done) {
	var url = 'http://www.ipdb.org/machine.cgi?id=' + ipdbNo;
	logger.info('[ipdb] Fetching %s', url);
	request({ url: url, timeout: 30000 }, function(err, response, body) {

		if (!response) {
			return done(error('Timeout while trying to reach IPDB.org. Please try again later.').log());
		}

		if (err) {
			return done(error(err, 'Error fetching %s', url).log());
		}

		if (response.statusCode !== 200) {
			logger.error('[ipdb] Wrong response code, got %s instead of 200. Body: %s', response.statusCode, body);
			return done(error('Wrong response data from IPDB.'));
		}

		parseDetails(body, done);
	});
};

function parseDetails(body, done) {

	var tidyText = function(m) {
		m = striptags(m).replace(/<br>/gi, '\n\n');
		return ent.decode(m.trim());
	};

	var m = body.match(/<a name="(\d+)">([^<]+)/i);
	var game = { ipdb: {}};
	if (m) {
		game.title = trim(m[2]);
		game.ipdb.number = number(m[1]);
		game.ipdb.mfg = number(firstMatch(body, /Manufacturer:\s*<\/b>.*?mfgid=(\d+)/i));
		if (game.ipdb.mfg && manufacturerNames[game.ipdb.mfg]) {
			game.manufacturer = manufacturerNames[game.ipdb.mfg];
		} else {
			game.manufacturer = firstMatch(body, />Manufacturer:.*?<a href="search\.pl\?searchtype=advanced&amp;mfgid=\d+">([^<]+)/i, function(m) {
				return m.replace(/[\s,]+$/, '');
			});
		}
		game.model_number = firstMatch(body, /Model Number:\s*<\/b><\/td><td[^>]*>(\d+)/i);
		game.year = number(firstMatch(body, /href="machine\.cgi\?id=\d+">\d+<\/a>\s*<I>[^<]*?(\d{4})/i));

		game.game_type = firstMatch(body, /Type:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
			var mm = m.match(/\((..)\)/);
			return mm ? mm[1].toLowerCase() : null;
		});

		game.ipdb.rating = firstMatch(body, /Average Fun Rating:.*?Click for comments[^\d]*([\d\.]+)/i);
		game.short = firstMatch(body, /Common Abbreviations:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
			return m.split(/,\s*/);
		});
		game.produced_units = firstMatch(body, /Production:\s*<\/b><\/td><td[^>]*>([\d,]+)\s*units/i, function(m) {
			return number(m.replace(/,/g, ''));
		});
		game.themes = firstMatch(body, /Theme:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
			return m.split(/\s+-\s+/gi);
		});
		game.designers = firstMatch(body, /Design by:\s*<\/b><\/td><td[^>]*><span[^>]*>(.*?)<\/tr>/i, function(m) {
			return ent.decode(striptags(m)).split(/,\s*/);
		});
		game.artists = firstMatch(body, /Art by:\s*<\/b><\/td><td[^>]*><span[^>]*>(.*?)<\/tr>/i, function(m) {
			return ent.decode(striptags(m)).split(/,\s*/);
		});

		game.features = firstMatch(body, /Notable Features:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
		game.notes = firstMatch(body, /Notes:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
		game.toys = firstMatch(body, /Toys:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
		game.slogans = firstMatch(body, /Marketing Slogans:\s*<\/b><\/td><td[^>]*>([\s\S]*?)<\/td>/i, tidyText);

		done(null, game);
	} else {
		if (/<\/script>\s*<hr width="80%">/.test(body)) {
			done(error('Empty page. Looks like IPDB number doens\'t exist.'));
		} else {
			done(error('Cannot parse game details from page body. Are you sure the provided IPDB No. exists?'));
		}
	}
}

function firstMatch(str, regex, postFn) {
	var m = str.match(regex);
	if (m && postFn) {
		return postFn(m[1].replace(/&nbsp;/gi, ' '));
	} else if (m) {
		return m[1].replace(/&nbsp;/gi, ' ');
	} else {
		return undefined;
	}
}

function number(str) {
	if (_.isUndefined(str)) {
		return undefined;
	}
	return parseInt(str);
}

function trim(str) {
	return str.replace(/[^-\w\d\s\.,:_'"()&]/ig, '');
}

function striptags(str) {
	return str.replace(/<(?:.|\n)*?>/gm, '');
}

var manufacturerNames = {
	2: 'Hankin',
	9: 'A.B.T.',
	16: 'All American Games',
	18: 'Allied Leisure',
	20: 'Alvin G.',
	32: 'Astro Games',
	33: 'Atari',
	47: 'Bally',
	48: 'Midway',
	49: 'Wulff',
	53: 'Bell Coin Matics',
	54: 'Bell Games',
	62: 'Briarwood',
	55: 'Bensa',
	71: 'CEA',
	76: 'Capcom',
	81: 'Chicago Coin',
	83: 'Unidesa',
	93: 'Gottlieb',
	94: 'Gottlieb',
	98: 'Data East',
	115: 'Europlay',
	117: 'Exhibit',
	120: 'Fascination',
	126: 'Game Plan',
	129: 'Geiger',
	130: 'Genco',
	135: 'Guiliano Lodola',
	139: 'Grand Products',
	141: 'Great States',
	145: 'Jac Van Ham',
	153: 'I.D.I.',
	156: 'Inder',
	157: 'Interflip',
	159: 'International Concepts',
	165: 'Jeutel',
	170: 'Juegos Populares',
	204: 'Maresa',
	206: 'Marvel',
	213: 'Midway',
	214: 'Bally',
	219: 'Mirco',
	222: 'Mr. Game',
	224: 'Gottlieb',
	235: 'Bell Games',
	239: 'P & S',
	242: 'Pamco',
	248: 'Petaco',
	249: 'Peyper',
	250: 'Pierce Tool',
	252: 'Pinstar',
	255: 'Playmatic',
	257: 'Premier',
	262: 'Petaco',
	267: 'Richard',
	269: 'Rock-ola',
	279: 'Sega',
	280: 'Sega',
	281: 'Williams',
	282: 'Sonic',
	302: 'Stern',
	303: 'Stern',
	311: 'Christian Tabart',
	313: 'Tecnoplay',
	317: 'Midway',
	323: 'United',
	324: 'Universal',
	328: 'Unknown',
	333: 'Viza',
	337: 'Wico',
	349: 'Williams',
	350: 'Williams',
	351: 'Williams',
	352: 'Williams',
	356: 'Zaccaria',
	359: 'RMG',
	367: 'Taito',
	371: 'Recreativos Franco',
	375: 'Spinball',
	419: 'Century Consolidated Industries',
	429: 'Acorn',
	458: 'Rowamet',
	447: 'Delmar',
	448: 'Electromatic',
	465: 'IDSA',
	467: 'LTD',
	477: 'Pinball Shop',
	482: 'Esteban',
	483: 'ICE',
	495: 'Elbos',
	530: 'Advertising Poster Company',
	532: 'United',
	549: 'Professional Pinball of Toronto',
	555: 'Fipermatic'
};

var manufacturerGroups = {
	Gottlieb: [ 'Gottlieb', 'Mylstar', 'Premier' ],
	Bally: [ 'Bally', 'Midway' ]
};

module.exports = new Ipdb();