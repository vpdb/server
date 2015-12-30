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
var Unrar = require('unrar');

var Release = require('mongoose').model('Release');
var Rom = require('mongoose').model('Rom');
var quota = require('../../modules/quota');
var flavor = require('../../modules/flavor');

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

	var counters = [];
	var requestedFiles = [];
	var requestedFileIds = body.files;
	var media = body.media || {};
	var numTables = 0;

	async.waterfall([

		/**
		 * Query release
		 * @param next
		 */
		function(next) {
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
					res.status(500).end();
					return next(true);
				}
				if (!release) {
					res.status(404).json({ error: 'No such release with ID "' + req.params.release_id + '".' }).end();
					return next(true);
				}

				next(null, release);
			});
		},

		/**
		 * Populate game in release
		 *
		 * @param release
		 * @param next
		 */
		function(release, next) {

			// populate game attributes since nested populates don't work: https://github.com/LearnBoost/mongoose/issues/1377
			release.populate({ path: '_game._media.logo _game._media.backglass', model: 'File' }, function(err, release) {
				/* istanbul ignore if  */
				if (err) {
					logger.log('[download] Error populating game from database: %s', err.message);
					res.status(500).end();
					return next(true);
				}

				// count release and user download
				counters.push(function(next) {
					release.incrementCounter('downloads', next);
				});
				counters.push(function(next) {
					req.user.incrementCounter('downloads', next);
				});

				next(null, release);
			});
		},

		/**
		 * Retrieve requested files
		 * @param release
		 * @param next
		 */
		function(release, next) {

			_.each(release.versions, function(version) {

				// check if there are requested table files for that version
				if (!_.intersection(_.pluck(_.pluck(version.files, '_file'), 'id'), requestedFileIds).length) {
					return; // continue
				}
				_.each(version.files, function(versionFile, pos) {
					var file = versionFile._file;
					file.release_version = version.toObj();
					file.release_file = versionFile.toObj();

					if (file.getMimeCategory() === 'table') {
						if (_.contains(requestedFileIds, file.id)) {
							requestedFiles.push(file);

							// count downloaded flavor
							counters.push(function(next) {
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
					counters.push(function(next) {
						file.incrementCounter('downloads', next);
					});
				});

				// count release download
				counters.push(function(next) {
					Release.update({ 'versions._id': version._id }, { $inc: { 'versions.$.counter.downloads': 1 }}, next);
				});

			});

			// count game download
			counters.push(function(next) {
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

			next(null, release);
		},

		/**
		 * Fetch ROMs if needed
 		 * @param release
		 * @param next
		 */
		function(release, next) {

			if (!body.roms) {
				return next(null, release);
			}

			Rom.find({ _game: release._game._id.toString() }).populate('_file').exec(function(err, roms) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[storage|download] Error fetching ROMs from DB: %s', err.message);
					res.status(500).end();
					return next(true);
				}

				// TODO only add roms referenced in game script
				_.each(roms, function(rom) {
					requestedFiles.push(rom._file);

					// count file download
					counters.push(function(next) {
						rom._file.incrementCounter('downloads', next);
					});
				});

				next(null, release);
			});
		},

		/**
		 * Check quota
 		 * @param release
		 * @param next
		 * @returns {*}
		 */
		function(release, next) {

			if (!requestedFiles.length) {
				res.status(422).json({ error: 'Requested file IDs did not match any release file.' }).end();
				return next(true);
			}

			// check the quota
			quota.isAllowed(req, res, requestedFiles, function(err, granted) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[storage|download] Error checking quota for <%s>: %s', req.user.email, err.message);
					res.status(500).end();
					return next(true);
				}
				if (!granted) {
					res.status(403).json({ error: 'Not enough quota left.' }).end();
					return next(true);
				}

				next(null, release);
			});
		},

		/**
		 * Update counters
 		 * @param release
		 * @param next
		 */
		function(release, next) {
			async.series(counters, function(err) {
				if (err) {
					logger.error('[storage|download] Error updating counters: %s', err.message);
				}
				next(null, release);
			});
		},

		/**
		 * Create download archive
 		 * @param release
		 * @param next
		 */
		function(release, next) {

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
			async.eachSeries(requestedFiles, function(file, nextFile) {

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
						switch (file.getMimeCategory()) {
							case 'table':
								var filename = getTableFilename(req.user, release, file, releaseFiles);
								releaseFiles.push(filename);
								name = 'Visual Pinball/Tables/' + filename;
								break;

							case 'audio':
								name = 'Visual Pinball/Music/' + file.name;
								break;

							case 'script':
								name = 'Visual Pinball/Scripts/' + file.name;
								break;

							case 'archive':
								if (file.metadata.entries && _.isArray(file.metadata.entries)) {
									if (/rar/i.test(file.getMimeSubtype())) {
										var rarfile = new Unrar(file.getPath());
										_.each(file.metadata.entries, function(entry) {
											var stream = rarfile.stream(entry.filename);
											archive.append(stream, {
												name: 'Visual Pinball/Tables/' + entry.filename.replace(/\\/g, '/'),
												date: entry.modified_at
											});
											stream.on('error', function(err) {
												logger.info('Error extracting file %s from rar: %s', entry.filename, err);
											});
										});
										return nextFile();
									}

								}


								// otherwise, add as normal file
								name = 'Visual Pinball/Tables/' + file.name;
								break;

							default:
								name = 'Visual Pinball/Tables/' + file.name;
						}
						break;
					case 'rom':
						name = 'Visual Pinball/VPinMame/roms/' + file.name;
						break;
				}
				// per default, put files into the root folder.
				name = name || file.name;
				archive.append(fs.createReadStream(file.getPath()), {
					name: name,
					date: file.created_at
				});
				nextFile();

			}, function() {
				if (release.description) {
					archive.append(release.description, { name: 'README.txt' });
				}
				archive.finalize();
				next();
			});
		}

	], function(err) {
		if (!err) {
			logger.info("Archive successfully created.");
		}
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
	var flavorTags = userPrefs.flavor_tags || flavor.defaultFileTags();

	var data = {
		game_title: release._game.title,
		game_manufacturer: release._game.manufacturer,
		game_year: release._game.year,
		release_name: release.name,
		release_version: file.release_version.version,
		release_compatibility: _.pluck(file.release_file.compatibility, 'label').join(','),
		release_flavor_orientation: flavorTags.orientation[file.release_file.flavor.orientation],
		release_flavor_lighting: flavorTags.lighting[file.release_file.flavor.lighting],
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