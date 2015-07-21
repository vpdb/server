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
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');

exports.upload = function(config) {

	config = config || {};
	var apiUri = config.apiUri || 'http://localhost:3000/api/v1';
	var storageUri = config.storageUri || 'http://localhost:3000/storage/v1';
	var authHeader = config.authHeader || 'Authorization';
	var credentials = config.credentials || {};

	if (config.httpSimple) {
		var httpSimple = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
	}

	var token;

	var root = path.normalize(__dirname);
	async.eachSeries(fs.readdirSync(path.resolve(root)), function(gameId, nextGame) {
		var gamePath = path.resolve(root, gameId);
		if (!fs.lstatSync(gamePath).isDirectory()) {
			return nextGame();
		}

		async.eachSeries(fs.readdirSync(gamePath), function(releaseName, nextRelease) {
			var releaseData;
			var releasePath = path.resolve(root, gameId, releaseName);
			if (!fs.lstatSync(releasePath).isDirectory()) {
				return nextRelease();
			}

			if (fs.existsSync(path.resolve(root, gameId, releaseName, 'index.json'))) {
				releaseData = fs.readFileSync(path.resolve(root, gameId, releaseName, 'index.json')).toString();
			} else {
				return nextRelease();
			}

			parseJson(releaseData, path.resolve(root, gameId, releaseName), function(err, releaseJson) {

				if (err) {
					return nextRelease(err);
				}
				releaseJson.name = releaseName;

				console.log(releaseJson);

				async.eachSeries(fs.readdirSync(releasePath), function(version, nextVersion) {
					var versionPath = path.resolve(root, gameId, releaseName, version);
					if (!fs.lstatSync(versionPath).isDirectory()) {
						return nextVersion();
					}

					console.log('Got game %s, release %s, version %s', gameId, releaseName, version);

					nextVersion();

				}, nextRelease);
			});

		}, nextGame);

	}, function(err) {
		if (err) {
			console.error("ERROR!");
			console.error(err);
		}
		console.log('All done!');
	});
};

function parseJson(data, pwd, done) {

	// replace references with file content
	data = data.replace(/"([^"]+)"\s*:\s*"!([^!][^"]+)"/g, function(match, attr, filename) {
		var refPath = path.resolve(pwd, filename);
		if (!fs.existsSync(refPath)) {
			return done(new Error('Cannot find reference of "' + attr + '" to ' + refPath + '.'));
		}
		var obj = {};
		obj[attr] = fs.readFileSync(refPath).toString();
		var json = JSON.stringify(obj);
		return json.substr(1, json.length - 2);
	});

	try {
		var json = JSON.parse(data);
	} catch (err) {
		return done(err);
	}
	done(null, json);
}
