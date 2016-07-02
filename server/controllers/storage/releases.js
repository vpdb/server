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

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const async = require('async');
const logger = require('winston');
const archiver = require('archiver');
const Unrar = require('unrar');
const unzip = require('unzip'); // adm-zip doesn't have a streaming api.

const Release = require('mongoose').model('Release');
const Rom = require('mongoose').model('Rom');
const Medium = require('mongoose').model('Medium');

const quota = require('../../modules/quota');
const flavor = require('../../modules/flavor');
const error = require('../../modules/error')('storage', 'release');
const api = require('../api/api');

/**
 * Downloads a release.
 *
 * You provide the release to download as well as the table file IDs for the
 * release.
 *
 * Example:
 *
 *    GET https://vpdb.io/storage/v1/releases/XkviQgQ6m?body={}&token=123
 *
 * where body is something like (url-encoded):
 *
 *  {
 *  	"files": [ "XJejOk7p7" ],
 *  	"media":{
 *  		"playfield_image":true,
 *  		"playfield_video":false
 *  	},
 *  	"game_media": [ "dfdDg35Sf", "gfppdDbNas" ],
 *  	"backglass": "hffDDsh34",
 *  }
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.download = function(req, res) {

	let body = null;
	let release;
	let counters = [];
	let requestedFiles = [];
	let requestedFileIds;
	let media;
	let numTables = 0;
	Promise.try(() => {

		if (req.query.body) {
			try {
				body = JSON.parse(req.query.body);
			} catch (e) {
				throw error(e, 'Error parsing JSON from URL query.').status(400);
			}
		}
		body = body || req.body;

		requestedFileIds = body.files;
		media = body.media || {};

		logger.log('[download] RELEASE: %s', JSON.stringify(body));
		if (!body || !_.isArray(body.files) || !body.files.length) {
			throw error('You need to provide which files you want to include in the download.').status(422);
		}

		return Release.findOne({ id: req.params.release_id })
			.populate({ path: '_game' })
			.populate({ path: '_game._media.backglass' })
			.populate({ path: '_game._media.logo' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._media.playfield_image' })
			.populate({ path: 'versions.files._media.playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s".', req.params.release_id).status(404);
		}
		return Medium.find({ '_ref.game': release._game._id }).populate('_file').exec();

	}).then(media => {

		// count release and user download
		counters.push(release.incrementCounter('downloads'));
		counters.push(req.user.incrementCounter('downloads'));

		release.versions.forEach(version => {

			// check if there are requested table files for that version
			if (!_.intersection(_.map(_.map(version.files, '_file'), 'id'), requestedFileIds).length) {
				return; // continue
			}
			version.files.forEach((versionFile, pos) => {
				let file = versionFile._file;
				file.release_version = version.toObj();
				file.release_file = versionFile.toObj();

				if (file.getMimeCategory() === 'table') {
					if (_.includes(requestedFileIds, file.id)) {
						requestedFiles.push(file);

						// count downloaded flavor
						counters.push(Release.update({ 'versions._id': version._id }, { $inc: { ['versions.$.files.' + pos + '.counter.downloads']: 1 } }));
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
				counters.push(file.incrementCounter('downloads'));
			});

			// count release download
			counters.push(Release.update({ 'versions._id': version._id }, { $inc: { 'versions.$.counter.downloads': 1 } }));
		});

		// count game download
		counters.push(release._game.update({ $inc: { 'counter.downloads': numTables } }));

		// add game media
		if (_.isArray(body.game_media)) {
			body.game_media.forEach(mediaId => {
				let medium = _.find(media, m => m.id === mediaId);
				if (!medium) {
					throw error('Medium with id %s is not part of the game\'s media.', mediaId).status(422);
				}
				requestedFiles.push(medium._file);
			});
		}

		// check for roms
		if (body.roms) {
			return Rom.find({ _game: release._game._id.toString() }).populate('_file').exec().then(roms => {
				// TODO only add starred rom or ask
				roms.forEach(function(rom) {
					requestedFiles.push(rom._file);
					// count file download
					counters.push(rom._file.incrementCounter('downloads'));
				});
			});
		}

	}).then(() => {

		if (!requestedFiles.length) {
			throw error('Requested file IDs did not match any release file.').status(422);
		}

		// check the quota
		return quota.isAllowed(req, res, requestedFiles);

	}).then(granted => {
		if (!granted) {
			throw error('Not enough quota left.').status(403);
		}

		// update counters
		return Promise.all(counters);

	}).then(() => {

		// create zip stream
		let archive = archiver('zip');
		let gameName = release._game.full_title;

		res.status(200);
		res.set({
			'Content-Type': 'application/zip',
			'Content-Disposition': 'attachment; filename="' + gameName + '.zip"' // todo add release name and authors to zip filename
		});
		archive.pipe(res);

		// add tables to stream
		let releaseFiles = [];
		Promise.each(requestedFiles, file => {

			let name = '';
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
							if (file.metadata && _.isArray(file.metadata.entries)) {
								if (/rar/i.test(file.getMimeSubtype())) {
									return streamZipfile(file, archive);
								}
								if (/zip/i.test(file.getMimeSubtype())) {
									return streamRarfile(file, archive);
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

		}).then(() => {
			if (release.description) {
				archive.append(release.description, { name: 'README.txt' });
			}
			if (release.acknowledgements) {
				archive.append(release.acknowledgements, { name: 'CREDITS.txt' });
			}
			archive.finalize();
			logger.info("Archive successfully created.");
		});

	}).catch(api.handleError(res, error, 'Error serving file'));
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
		release_compatibility: _.map(file.release_file.compatibility, 'label').join(','),
		release_flavor_orientation: flavorTags.orientation[file.release_file.flavor.orientation],
		release_flavor_lighting: flavorTags.lighting[file.release_file.flavor.lighting],
		original_filename: path.basename(file.name)
	};

	var filebase = tableName.replace(/(\{\s*([^}\s]+)\s*})/g, function(m1, m2, m3) {
		return _.isUndefined(data[m3]) ? m1 : data[m3];
	});

	// check for already used names and suffix with (n)
	var newFilename, n = 0;
	if (_.includes(releaseFiles, filebase + file.getExt())) {
		do {
			n++;
			newFilename = filebase + ' (' + n + ')' + file.getExt();
		} while (_.includes(releaseFiles, newFilename));
		return newFilename;
	} else {
		return filebase + file.getExt();
	}
}

function getArchivedFilename(entryPath, archiveName) {
	entryPath = entryPath.replace(/\\/g, '/');
	entryPath = entryPath.replace(/^\//, '');
	if (path.basename(entryPath) === entryPath) {
		entryPath = archiveName.substr(0, archiveName.length - path.extname(archiveName).length) + '/' + entryPath;
	}
	return 'Visual Pinball/Tables/' + entryPath;
}

/**
 * Streams the contents of a zip file into the current zip archive.
 * @param {File} file Zip file to stream (source)
 * @param archive Destination
 * @returns {Promise}
 */
function streamZipfile(file, archive) {
	return new Promise(resolve => {
		let rarfile = new Unrar(file.getPath());
		file.metadata.entries.forEach(entry => {
			let stream = rarfile.stream(entry.filename);
			archive.append(stream, {
				name: getArchivedFilename(entry.filename, file.name),
				date: entry.modified_at
			});
			stream.on('error', err => {
				logger.info('Error extracting file %s from rar: %s', entry.filename, err);
			});
			stream.on('close', resolve);
		});
	});
}

/**
 * Streams the contents of a rar file into the current zip archive.
 * @param {File} file RAR file to stream (source)
 * @param archive Destination
 * @returns {Promise}
 */
function streamRarfile(file, archive) {
	return new Promise(resolve => {
		fs.createReadStream(file.getPath())
			.pipe(unzip.Parse())
			.on('entry', entry => {
				if (entry.type === 'File') {
					archive.append(entry, {
						name: getArchivedFilename(entry.path, file.name)
					});
				} else {
					entry.autodrain();
				}
			})
			.on('error', err => logger.info('Error extracting from zip: %s', err.message))
			.on('close', resolve);
	});
}