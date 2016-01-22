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
var http = require('http');
var path = require('path');
var util = require('util');
var mongoose = require('mongoose');

var settings = require('../modules/settings');
var config = settings.current;

var storage = require('../modules/storage');

// bootstrap db connection
mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } } });

// bootstrap models
var modelsPath = path.resolve(__dirname, '../models');
fs.readdirSync(modelsPath).forEach(function(file) {
	if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
		require(modelsPath + '/' + file);
	}
});

var User = mongoose.model('User');
var File = mongoose.model('File');

var display = function(err, res) {
	if (err) {
		return console.error('ERROR: %s', err);
	}
	console.log(util.inspect(res, false, 4, true));
};

var args = process.argv.slice(2);
var query = _.isArray(args) && args.length ? { id: { $in: args } } : { variations: { $exists : true, $ne : null }};
console.log(query);
File.find(query, function(err, files) {
	if (err) {
		return display(err, files);
	}
	files.forEach(function(file) {
		storage.postprocess(file, true);
	});
});