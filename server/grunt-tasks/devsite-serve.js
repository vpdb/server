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
var path = require('path');
var express = require('express');

var settings = require('../modules/settings');
var writeable = require('../modules/writeable');

module.exports = function(grunt) {

	grunt.registerTask('devsite-serve', function() {

		var done = this.async();
		var options = this.options() || {};

		// default options
		var port = options.port || 4000;
		var root = options.root || process.cwd();
		var map = options.map || {};
		var defaultPage = options.defaultPage || path.resolve(root, 'index.html');

		// setup express
		var app = express();

		app.use(express.static(root));
		_.each(map, function(val, key) {
			grunt.log.writeln('Mapping path %s to %s.', key, val);
			app.use(key, express.static(val));
		});
		app.use(function(req, res, next) {
			if (/\/[^\.]*$/.test(req.path) || /\.\d+$/.test(req.path)) {
				res.sendFile(defaultPage);
			} else {
				next();
			}
		});
		app.use('/js/config.js', express.static(path.resolve(writeable.jsRoot, settings.clientConfigName()), { maxAge: 3600 * 24 * 30 * 1000 }));

		// start express
		app.listen(port);
		grunt.log.writeln('Devsite ready at 127.0.0.1:%d', port);

		// async support - run in background
		if (options.runInBackground) {
			done();
		}

	});

};
