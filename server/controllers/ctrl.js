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

var _ = require('lodash');
var builder = require('xmlbuilder');

var settings = require('../modules/settings');

/**
 * Returns the parameter object that is accessible when rendering the views.
 * @param {boolean} [gitInfoFromGrunt] If true, don't require gitinfo but put a Grunt placeholder.
 */
/* istanbul ignore next: Not generating markup when running tests.  */
exports.viewParams = function(gitInfoFromGrunt) {

	var config = require('../modules/settings').current;
	var assets = require('../modules/assets');

	return {
		deployment: process.env.APP_NAME || 'staging',
		environment: process.env.NODE_ENV || 'development',
		gitinfo: gitInfoFromGrunt ? '<%= gitinfo %>' : require('../modules/gitinfo').info,
		jsFiles: assets.getJs(),
		cssFiles: assets.getCss(),
		authStrategies: {
			local: true,
			github: config.vpdb ? config.vpdb.passport.github.enabled : false,
			google: config.vpdb ? config.vpdb.passport.google.enabled : false,
			ipboard: _.map(_.filter(config.vpdb ? config.vpdb.passport.ipboard : [], function(ipbConfig) { return ipbConfig.enabled; }), function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		},
		svgDefs: config.vpdb.tmp + '/vpdb-svg/_svg-defs.svg'
	};
};

exports.sitemap = function(req, res) {

	const Game = require('mongoose').model('Game');
	const Medium = require('mongoose').model('Medium');

	let rootNode = builder
		.create('urlset', { version: '1.0', encoding: 'UTF-8' })
		.att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
		.att('xmlns:image', 'http://www.google.com/schemas/sitemap-image/1.1');

	Promise.try(() => {
		return Game.find({}).exec();

	}).then(games => {

		console.log('found %s games.', games.length);
		return Promise.each(games, game => {
			const url = rootNode.ele('url');
			url.ele('loc', settings.webUri('/games/' + game.id));

			return Medium.find({ '_ref.game': game._id }).populate({ path: '_file' }).exec().then(media => {
				media.forEach(medium => {
					switch (medium.category) {
						case 'wheel_image': {
							let img = url.ele('image:image');
							img.ele('image:loc', medium._file.getUrl('medium-2x'));
							img.ele('image:caption', 'Logo for ' + game.title);
							break;
						}
						case 'backglass_image': {
							let img = url.ele('image:image');
							img.ele('image:loc', medium._file.getUrl('full'));
							img.ele('image:caption', 'Backglass for ' + game.title);
							break;
						}
					}
				});
			});
		});

	}).then(() => {
		res.setHeader('Content-Type', 'application/xml');
		res.send(rootNode.end({ pretty: true}));

	}).catch(err => {
		console.error('ERROR:', err.stack);
		res.status(500).send(err.message);
	});


};