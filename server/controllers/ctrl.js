/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

/**
 * Returns the parameter object that is accessible when rendering the views.
 * @param {object} [conf] Conf
 * @param {boolean} [gitInfoFromGrunt] If true, don't require gitinfo but put a Grunt placeholder.
 */
exports.viewParams = function(config, gitInfoFromGrunt) {

	config = config || require('../modules/settings').current;
	var assets = require('../modules/assets');

	return {
		deployment: process.env.APP_NAME || 'staging',
		environment: process.env.NODE_ENV || 'development',
		gitinfo: gitInfoFromGrunt ? '<%= gitinfo %>' : require('../modules/gitinfo').info,
		jsFiles: assets.getJs(),
		cssFiles: assets.getCss(),
		authStrategies: {
			local: true,
			github: config ? config.vpdb.passport.github.enabled : false,
			ipboard: _.map(_.filter(config ? config.vpdb.passport.ipboard : [], function(ipbConfig) { return ipbConfig.enabled; }), function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		},
		authHeader: config.vpdb.authorizationHeader
	};
};

/**
 * Renders an error. Depending of the path of the request, different
 * @param code
 * @param message
 * @returns {Function}
 */
exports.renderError = function(code, message) {
	return function(req, res) {

		// for API calls, return json
		if (req.originalUrl.substr(0, 5) === '/api/') {
			res.setHeader('Content-Type', 'application/json');
			res.status(code).send({ error: message });

		// for partials, return a partial
		} else if (req.originalUrl.substr(0, 10) === '/partials/') {
			// return 200 because otherwise angular doesn't render the partial view.
			res.status(200).send('<h1>Oops!</h1><p>' + message + '</p>');

		// otherwise, return the full page.
		} else {
			exports.viewParams(function(params) {
				var tpl = _.contains([403, 404, 500, 502], code) ? code : '000';
				res.status(code).render('errors/' + tpl, _.extend(params, { url: req.originalUrl, code: code, message: message }));
			});
		}
	};
};