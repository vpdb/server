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

var mimetypes = require('../../../server/modules/mimetypes');

var uploadOnly = '';

exports.upload = function(config) {

	config = config || {};
	var apiUri = config.apiUri || 'http://localhost:3000/api/v1';
	var storageUri = config.storageUri || 'http://localhost:3000/storage/v1';
	var authHeader = config.authHeader || 'Authorization';
	var credentials = config.credentials || {};
	var folder = config.folder || path.resolve(__dirname);

	if (config.httpSimple) {
		var httpSimple = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
	}

	// 1. authenticate
	var headers = {};
	if (httpSimple) {
		headers.Authorization = httpSimple;
	}
	var url = apiUri + '/authenticate';
	console.log('Authenticating at %s...', url);
	request.post(url).set(headers).send(credentials).end(function(err, res) {
		if (err) {
			return console.error('Error obtaining token: %s', err);
		}
		if (res.status !== 200) {
			return console.error('Error obtaining token: %s', JSON.stringify(res.body));
		}
		console.log('Authentication successful.');
		headers[authHeader] = 'Bearer ' + res.body.token;
		var config = {
			storageUri: storageUri,
			headers: headers
		};
		var userId = res.body.user.id;

		var root = path.resolve(folder, 'releases');
		async.eachSeries(fs.readdirSync(path.resolve(root)), function(gameId, nextGame) {
			var gamePath = path.resolve(root, gameId);
			if (!fs.lstatSync(gamePath).isDirectory()) {
				return nextGame();
			}
			if (uploadOnly && gameId !== uploadOnly) {
				console.log("Skipping game %s..", gameId);
				return nextGame();
			}

			async.eachSeries(fs.readdirSync(gamePath), function(releaseName, nextRelease) {
				var releaseData, releasePath = path.resolve(root, gameId, releaseName);
				if (!fs.lstatSync(releasePath).isDirectory()) {
					return nextRelease();
				}

				// read index.json
				var releaseJsonPath = path.resolve(releasePath, 'index.json');
				if (fs.existsSync(releaseJsonPath)) {
					releaseData = fs.readFileSync(releaseJsonPath).toString();
				} else {
					console.error('Missing index.json at ' + releasePath + ', skipping.');
					return nextRelease();
				}

				parseJson(releaseData, releasePath, config, function(err, releaseJson) {

					if (err) {
						return nextRelease(err);
					}
					releaseJson._game = gameId;
					releaseJson.name = releaseName;
					releaseJson.versions = [];
					releaseJson.authors = [ { _user: userId, roles: [ 'Uploader' ] } ];

					async.eachSeries(fs.readdirSync(releasePath), function(version, nextVersion) {
						var versionData, versionPath = path.resolve(root, gameId, releaseName, version);
						if (!fs.lstatSync(versionPath).isDirectory()) {
							return nextVersion();
						}

						// read index.json
						var versionJsonPath = path.resolve(versionPath, 'index.json');
						if (fs.existsSync(versionJsonPath)) {
							versionData = fs.readFileSync(versionJsonPath).toString();
						} else {
							console.error('Missing index.json at ' + versionJsonPath + ', skipping.');
							return nextVersion();
						}

						parseJson(versionData, versionPath, config, function(err, versionJson) {
							if (err) {
								return nextVersion(err);
							}
							versionJson.version = version;
							releaseJson.versions.push(versionJson);
							nextVersion();
						});

					}, function(err) {
						if (err) {
							return nextRelease(err);
						}

						// post
						console.log(require('util').inspect(releaseJson, { depth: null, colors: true }));
						request
							.post(apiUri + '/releases')
							.type('application/json')
							.set(headers)
							.send(releaseJson)
							.end(function(err, res) {
								if (err) {
									return nextRelease(err);
								}
								console.log('Release "%s" for game "%s" successfully uploaded.', releaseName, gameId);
								nextRelease();
							});
					});
				});

			}, nextGame);

		}, function(err) {
			if (err) {
				console.error("ERROR!");
				console.error(err);
			}
			console.log('All done!');
		});
	});
};

function parseJson(data, pwd, config, done) {

	// replace references with file content
	var err;
	data = data.replace(/"([^"]+)"\s*:\s*"!([^!][^"]+)"/g, function(match, attr, filename) {
		var refPath = path.resolve(pwd, filename);
		if (!fs.existsSync(refPath)) {
			err = new Error('Cannot find reference of "' + attr + '" to ' + refPath + '.');
			return;
		}
		var obj = {};
		obj[attr] = fs.readFileSync(refPath).toString();
		var json = JSON.stringify(obj);
		return json.substr(1, json.length - 2);
	});
	if (err) {
		return done(err);
	}

	// deserialize
	try {
		var json = JSON.parse(data);
	} catch (err) {
		return done(err);
	}

	// if there are no files, we're done.
	if (!json.files) {
		return done(null, json);
	}

	var files = [];
	_.each(json.files, function(file, i) {
		if (_.get(file, '_file')) {
			files.push({
				path: 'files[' + i + ']._file',
				filename: _.get(file, '_file'),
				filetype: 'release'
			});
		}
		if (_.get(file, '_media.playfield_image')) {
			files.push({
				path: 'files[' + i + ']._media.playfield_image',
				filename: _.get(file, '_media.playfield_image'),
				filetype: 'playfield-' + _.get(file, 'flavor.orientation')
			});
		}
		if (_.get(file, '_media.playfield_video')) {
			files.push({
				path: 'files[' + i + ']._media.playfield_video',
				filename: _.get(file, '_media.playfield_video'),
				filetype: 'playfield-' + _.get(file, 'flavor.orientation')
			});
		}
	});


	// some minimal validations...
	var file, refPath;
	for (var i = 0; i < files.length; i++) {
		file = files[i];
		if (!getMimeType(file.filename)) {
			return done('Unknown MIME type of "' + file.filename + '".');
		}
		refPath = path.resolve(pwd, file.filename);
		if (!fs.existsSync(refPath)) {
			return done(new Error('Cannot find reference of "' + file.path + '" to ' + refPath + '.'));
		}
	}

	async.each(files, function(file, next) {

		var fileContents = fs.readFileSync(path.resolve(pwd, file.filename));
		var headers = _.extend(_.cloneDeep(config.headers), {
			'Content-Disposition': 'attachment; filename="' + file.filename + '"',
			'Content-Length': fileContents.length
		});
		console.log('Posting %s (%s)...', file.filename, getMimeType(file.filename));
		request.post(config.storageUri + '/files').query({ type: file.filetype }).set(headers).type(getMimeType(file.filename)).send(fileContents).end(function(err, res) {

			if (err) {
				return next(err);
			}
			_.set(json, file.path, res.body.id);
			next();
		});

	}, function(err) {
		if (err) {
			return done(err);
		}
		done(null, json);
	});
}

function getMimeType(filename) {
	var ext = path.extname(filename).substr(1).toLowerCase();
	for (var mimetype in mimetypes) {
		if (mimetypes.hasOwnProperty(mimetype) && mimetypes[mimetype].ext === ext) {
			return mimetype;
		}
	}
}