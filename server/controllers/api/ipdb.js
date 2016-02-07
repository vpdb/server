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

var api = require('./api');
var ipdb = require('../../modules/ipdb');
var logger = require('winston');

exports.view = function(req, res) {

	if (req.query.dryrun) {
		logger.info('[ipdb] Dry run, returning data for Monster Bash.');
		api.success(res, { ipdb: { no: 4441, mfg: 349, rating: 8.3 }, name: "Monster Bash", manufacturer: "Williams", model_number: 50065, year: 1998, type: "SS", short: [ "MB" ], units: 3361, theme: [ "Horror", "Licensed Theme" ], designers: [ "George Gomez" ], artists: [ "Kevin O'Connor" ] }, 200);
	} else {
		ipdb.details(req.params.id, function(err, game) {
			/* istanbul ignore if  */
			if (err) {
				api.fail(res, err, 500);
			} else {
				api.success(res, game);
			}
		});
	}
};
