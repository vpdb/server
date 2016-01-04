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

/**
 * Returns the parameter object that is accessible when rendering the views.
 * @param {boolean} [gitInfoFromGrunt] If true, don't require gitinfo but put a Grunt placeholder.
 */
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
