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
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var storage = require('./modules/storage');
var queue = require('./modules/queue');
var error = require('./modules/error')('startup');

exports.init = function() {

	return Promise.try(() => {
		logger.info('[startup] Executing startup scripts...');

		// clear queues
		queue.empty();

		// cleanup inactive storage
		logger.info('[startup] Cleaning up inactive storage files older than one week.');
		return storage.cleanup(3600000 * 24 * 7);

	}).then(() => {

		// populate database
		let modelsPath = path.resolve(__dirname, '../data/database');
		let datas = _.compact(fs.readdirSync(modelsPath).map(file => {
			if (fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
				return null;
			}
			return require(modelsPath + '/' + file);
		}));

		return Promise.each(datas, data => {
			var Model = require('mongoose').model(data.model);

			// check if empty
			return Model.count({}).then(num => {

				/* istanbul ignore if: Database is always empty before running tests. */
				if (num) {
					logger.info('[startup] Skipping data population for model "%s", table is not empty.', data.model);
					return;
				}
				logger.info('[startup] Inserting %d rows into table "%s"..', data.rows.length, data.model);
				return Model.collection.insert(data.rows);
			});
		});
	});
};