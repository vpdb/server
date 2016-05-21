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

var fs = require('fs');
var logger = require('winston');
var File = require('mongoose').model('File');
var storage = require('./storage');

/**
 * Creates a new file from a HTTP request stream.
 *
 * @param {object} fileData Model data
 * @param {Stream} readStream Binary stream of file content
 * @param {function} error Error logger
 * @param {function} [callback] Callback, executed with err and file.
 * @return {Promise.<FileSchema>}
 */
exports.create = function(fileData, readStream, error, callback) {

	var file;
	return Promise.try(function() {
		file = new File(fileData);
		return file.validate();

	}).then(() => {
		return file.save();

	}).then(f => {
		file = f;
		return new Promise(function(resolve, reject) {
			var writeStream = fs.createWriteStream(file.getPath());
			writeStream.on("finish", resolve);
			writeStream.on("error", reject);
			readStream.pipe(writeStream);
		});

	}).then(() => {
		// we don't have the file size for multipart uploads before-hand, so get it now
		if (!file.bytes) {
			var stats = fs.statSync(file.getPath());
			return File.update({ _id: file._id }, { bytes: stats.size });
		}

	}).then(() => {
		return storage.preprocess(file);

	}).then(() => {
		return storage.metadata(file).catch(err => {

			// fail and remove file if metadata failed
			return file.remove().catch(err => {
				/* istanbul ignore next */
				logger.error('[api|file:save] Error removing file: %s', err.message);

			}).then(function() {
				throw error(err, 'Metadata parsing failed for type "%s": %s', file.mime_type, err.message).short().warn().status(400);
			});
		});

	}).then(metadata => {

		File.sanitizeObject(metadata);
		file.metadata = metadata;
		return File.update({ _id: file._id }, { metadata: metadata });

	}).then(() => {

		logger.info('[api|file:save] File upload of %s successfully completed.', file.toString());

		// do this in the background.
		storage.postprocess(file);
		return file;

	}).nodeify(callback);
};