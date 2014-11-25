/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var storage = require('../../modules/storage');
var acl = require('../../acl');


/**
 * Downloads a release.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.download = function(req, res) {

	var query = Release.findOne({ id: req.params.release_id })
		.populate({ path: '_game' })
		.populate({ path: 'authors._user' })
		.populate({ path: 'versions.files._file' });

	query.exec(function(err, release) {
		if (err) {
			return res.status(500).end();
		}
		var files = _.pluck(_.flatten(_.pluck(release.versions, 'files')), '_file');
		var archive = archiver('zip');

		res.status(200);
		res.set({
			'Content-Type': 'application/zip',
			'Content-disposition': 'attachment; filename="' + release._game.full_title + '.zip"'
		});
		archive.pipe(res);

		_.each(files, function(file) {
			archive.append(fs.createReadStream(file.getPath()), { name: file.name, date: file.created_at });
		});
		archive.append(release.name, { name: 'README.txt' });
		archive.finalize();

	});
};

