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
var async = require('async');
var logger = require('winston');
var archiver = require('archiver');
var objectPath = require('object-path');

var Release = require('mongoose').model('Release');
var Game = require('mongoose').model('Game');
var quota = require('../../modules/quota');

/**
 * Downloads a release.
 *
 * You provide the release to download as well as the table file IDs for the
 * release.
 *
 * Example:
 *
 *    GET https://vpdb.ch/storage/v1/releases/XkviQgQ6m?body={}&token=123
 *
 * where body is something like (url-encoded):
 *
 *    {"files":["XJejOk7p7"],"media":{"playfield_image":true,"playfield_video":false},"game_media":true}
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.download = function(req, res) {

	var body = null;
	try {
		if (req.query.body) {
			body = JSON.parse(req.query.body);
		}
	} catch (e) {
		return res.status(400).json({ error: 'Error parsing JSON from URL query.', cause: e.message }).end();
	}
	body = body || req.body;

	logger.log('[download] RELEASE: %s', JSON.stringify(body));
	if (!body || !_.isArray(body.files) || !body.files.length) {
		return res.status(422).json({ error: 'You need to provide which files you want to include in the download.' }).end();
	}

	// get release first
	var query = Release.findOne({ id: req.params.release_id })
		.populate({ path: '_game' })
		.populate({ path: '_game._media.backglass' })
		.populate({ path: '_game._media.logo' })
		.populate({ path: 'authors._user' })
		.populate({ path: 'versions.files._file' })
		.populate({ path: 'versions.files._media.playfield_image' })
		.populate({ path: 'versions.files._media.playfield_video' })
		.populate({ path: 'versions.files._compatibility' });

	query.exec(function(err, release) {
		/* istanbul ignore if  */
		if (err) {
			logger.log('[download] Error fetching release from database: %s', err.message);
			return res.status(500).end();
		}
		if (!release) {
			return res.status(404).json({ error: 'No such release with ID "' + req.params.release_id + '".' }).end();
		}

		// populate game attributes since nested populates don't work: https://github.com/LearnBoost/mongoose/issues/1377
		release.populate({ path: '_game._media.logo _game._media.backglass', model: 'File' }, function(err, release) {
			/* istanbul ignore if  */
			if (err) {
				logger.log('[download] Error populating game from database: %s', err.message);
				return res.status(500).end();
			}

			var requestedFiles = [];
			var requestedFileIds = body.files;
			var media = body.media || {};
			var counterUpdates = [];
			var numTables = 0;

			// count release and user download
			counterUpdates.push(function(next) {
				release.update({ $inc: { 'counter.downloads': 1 }}, next);
			});
			counterUpdates.push(function(next) {
				req.user.update({ $inc: { 'counter.downloads': 1 }}, next);
			});

			_.each(release.versions, function(version) {

				// check if there are requested table files for that version
				if (!_.intersection(_.pluck(_.pluck(version.files, '_file'), 'id'), requestedFileIds).length) {
					return; // continue
				}
				_.each(version.files, function(versionFile, pos) {
					var file = versionFile._file;
					file.release_version = version.obj();
					file.release_file = versionFile.obj();

					if (file.getMimeCategory() === 'table') {
						if (_.contains(requestedFileIds, file.id)) {
							requestedFiles.push(file);

							// count downloaded flavor
							counterUpdates.push(function(next) {
								var inc = { $inc: {} };
								inc.$inc['versions.$.files.' + pos + '.counter.downloads'] = 1;
								Release.update({ 'versions._id': version._id }, inc, next);
							});
							numTables++;

							// add media if checked
							_.each(versionFile._media, function(mediaFile, mediaName) {
								if (media[mediaName]) {
									requestedFiles.push(mediaFile);
								}
							});
						}

					// always add any non-table files
					} else {
						requestedFiles.push(file);
					}

					// count file download
					counterUpdates.push(function(next) {
						file.update({ $inc: { 'counter.downloads': 1 }}, next);
					});
				});

				// count release download
				counterUpdates.push(function(next) {
					Release.update({ 'versions._id': version._id }, { $inc: { 'versions.$.counter.downloads': 1 }}, next);
				});

			});

			// count game download
			counterUpdates.push(function(next) {
				release._game.update({ $inc: { 'counter.downloads': numTables }}, next);
			});

			// add game media?
			if (body.game_media && release._game._media) {
				if (release._game._media.backglass) {
					requestedFiles.push(release._game._media.backglass);
				}
				if (release._game._media.logo) {
					requestedFiles.push(release._game._media.logo);
				}
			}

			if (!requestedFiles.length) {
				return res.status(422).json({ error: 'Requested file IDs did not match any release file.' }).end();
			}

			// check the quota
			quota.isAllowed(req, res, requestedFiles, function(err, granted) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[storage|download] Error checking quota for <%s>: %s', req.user.email, err.message);
					return res.status(500).end();
				}
				if (!granted) {
					return res.status(403).json({ error: 'Not enough quota left.' }).end();
				}

				// update counters
				async.series(counterUpdates, function(err) {
					if (err) {
						logger.error('[storage|download] Error updating counters: %s', err.message);
					}

					// create zip stream
					var archive = archiver('zip');
					var gameName = release._game.full_title;

					res.status(200);
					res.set({
						'Content-Type': 'application/zip',
						'Content-Disposition': 'attachment; filename="' + gameName + '.zip"'
					});
					archive.pipe(res);

					// add tables to stream
					var releaseFiles = [];
					_.each(requestedFiles, function (file) {
						var name = '';
						switch (file.file_type) {
							case 'logo':
								name = 'PinballX/Media/Visual Pinball/Wheel Images/' + gameName + file.getExt();
								break;
							case 'backglass':
								name = 'PinballX/Media/Visual Pinball/Backglass Images/' + gameName + file.getExt();
								break;
							case 'playfield-fs':
							case 'playfield-ws':
								if (file.getMimeCategory() === 'image') {
									name = 'PinballX/Media/Visual Pinball/Table Images/' + gameName + file.getExt();
								}
								if (file.getMimeCategory() === 'video') {
									name = 'PinballX/Media/Visual Pinball/Table Videos/' + gameName + file.getExt();
								}
								break;
							case 'release':
								var filename = getTableFilename(req.user, release, file, releaseFiles);
								releaseFiles.push(filename);
								name = 'Visual Pinball/Tables/' + filename;
								break;
						}
						// per default, put files into the root folder.
						name = name || file.name;
						archive.append(fs.createReadStream(file.getPath()), {
							name: name,
							date: file.created_at
						});

					});
					if (release.description) {
						archive.append(release.description, { name: 'README.txt' });
					}
					archive.finalize();
				});
			});
		});
	});
};

/**
 * Returns the name of the table file within the zip archive, depending on the
 * user's preferences.
 *
 * @param user User object
 * @param release Release object
 * @param file File object
 * @param releaseFiles List of already used file names, in order to avoid dupes
 * @returns {string} File name
 */
function getTableFilename(user, release, file, releaseFiles) {

	var userPrefs = user.preferences || {};
	var tableName = userPrefs.tablefile_name || '{game_title} ({game_manufacturer} {game_year})';
	var flavorTags = userPrefs.flavor_tags || {
			orientation: { fs: 'FS', ws: 'DT' },
			lightning: { day: '', night: 'Nightmod' }
		};

	var data = {
		game_title: release._game.title,
		game_manufacturer: release._game.manufacturer,
		game_year: release._game.year,
		release_name: release.name,
		release_version: file.release_version.version,
		release_compatibility: _.pluck(file.release_file.compatibility, 'label').join(','),
		release_flavor_orientation: flavorTags.orientation[file.release_file.flavor.orientation],
		release_flavor_lightning: flavorTags.lightning[file.release_file.flavor.lightning],
		original_filename: file.name
	};

	var filebase = tableName.replace(/(\{\s*([^}\s]+)\s*})/g, function(m1, m2, m3) {
		return _.isUndefined(data[m3]) ? m1 : data[m3];
	});

	// check for already used names and suffix with (n)
	var newFilename, n = 0;
	if (_.contains(releaseFiles, filebase + file.getExt())) {
		do {
			n++;
			newFilename = filebase + ' (' + n + ')' + file.getExt();
		} while (_.contains(releaseFiles, newFilename));
		return newFilename;
	} else {
		return filebase + file.getExt();
	}
}