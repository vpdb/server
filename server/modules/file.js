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

var fs = require('fs');
var logger = require('winston');
var File = require('mongoose').model('File');
var storage = require('./storage');

/**
 * Creates a new file
 * @param {object} fileData Model data
 * @param {stream} readStream Binary stream of file content
 * @param {function} error Error logger
 * @param {function} callback Callback, error object takes error and code.
 */
exports.create = function(fileData, readStream, user, error, callback) {

	var file = new File(fileData);

	file.validate(function(err) {
		if (err) {
			return callback({ error: error('Validations failed. See below for details.').errors(err.errors).warn('create'), code: 422 });
		}

		file.save(function(err, file) {
			/* istanbul ignore if */
			if (err) {
				return callback({ error: error(err, 'Unable to save file'), code: 500 });
			}

			var writeStream = fs.createWriteStream(file.getPath());
			writeStream.on('finish', function() {
				storage.metadata(file, function(err, metadata) {
					if (err) {
						return file.remove(function(err) {
							/* istanbul ignore if */
							if (err) {
								logger.error('[api|file:save] Removing file due to erroneous metadata: %s', err, {});
							}
							return callback({ error: error('Metadata parsing for MIME type "%s" failed. Upload corrupted or weird format?', file.mime_type), code: 400 });
						});
					}
					if (!metadata) {
						// no need to re-save
						return callback(null, file, 201);
					}

					File.sanitizeObject(metadata);
					file.metadata = metadata;

					file.save(function(err, file) {
						/* istanbul ignore if */
						if (err) {
							logger.error('[api|file:save] Error saving metadata: %s', err, {});
							logger.error('[api|file:save] Metadata: %s', require('util').inspect(metadata));
						}
						logger.info('[api|file:save] File upload of %s by <%s> successfully completed.', file.toString(), user.email);
						callback(null, file, 201);

						// do this in the background.
						storage.postprocess(file);
					});
				});
			});
			/* istanbul ignore next */
			writeStream.on('error', function(err) {
				return callback({ error: error(err, 'Error saving data').log('save'), code: 500 });
			});

			readStream.pipe(writeStream);
		});
	});
};
