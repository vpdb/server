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
var logger = require('winston');
var archiver = require('archiver');

var Release = require('mongoose').model('Release');
var quota = require('../../modules/quota');

/**
 * Downloads a release.
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

	var query = Release.findOne({ id: req.params.release_id })
		.populate({ path: '_game' })
		.populate({ path: '_game._media.backglass' })
		.populate({ path: '_game._media.logo' })
		.populate({ path: 'authors._user' })
		.populate({ path: 'versions.files._file' })
		.populate({ path: 'versions.files._media.playfield_image' })
		.populate({ path: 'versions.files._media.playfield_video' });

	query.exec(function(err, release) {
		/* istanbul ignore if  */
		if (err) {
			return res.status(500).end();
		}
		if (!release) {
			return res.status(404).json({ error: 'No such release with ID "' + req.params.release_id + '".' }).end();
		}
		release.populate({ path: '_game._media.logo _game._media.backglass', model: 'File' }, function(err, release) {

			var files = [];
			var fileIds = body.files;
			var media = body.media || {};
			_.each(release.versions, function(version) {

				// check if there are table files for that version
				if (!_.intersection(_.pluck(_.pluck(version.files, '_file'), 'id'), fileIds).length) {
					return; // continue
				}
				_.each(version.files, function(versionFile) {
					var file = versionFile._file;

					if (file.getMimeCategory() === 'table') {
						if (_.contains(fileIds, file.id)) {
							files.push(file);

							// add media if checked
							_.each(versionFile._media, function(mediaFile, mediaName) {
								if (media[mediaName]) {
									files.push(mediaFile);
								}
							});
						}

					// always add any non-table files
					} else {
						files.push(file);
					}
				});
			});

			// add game media?
			if (body.game_media && release._game._media) {
				if (release._game._media.backglass) {
					files.push(release._game._media.backglass);
				}
				if (release._game._media.logo) {
					files.push(release._game._media.logo);
				}
			}

			if (!files.length) {
				return res.status(422).json({ error: 'Provided file IDs did not match any release file.' }).end();
			}


			// check the quota
			quota.isAllowed(req, res, files, function(err, granted) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[storage|download] Error checking quota for <%s>: %s', req.user.email, err, {});
					return res.status(500).end();
				}
				if (!granted) {
					return res.status(403).json({ error: 'Not enough quota left.' }).end();
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
				_.each(files, function (file) {
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
							name = 'Visual Pinball/Tables/' + file.name;
							break;
					}
					// per default, put files into the root folder.
					name = name || file.name;
					archive.append(fs.createReadStream(file.getPath()), {
						name: name,
						date: file.created_at
					});
				});
				archive.append(release.description, { name: 'README.txt' });
				archive.finalize();

			});
		});
	});

};

