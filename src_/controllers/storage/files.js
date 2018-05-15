/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

'use strict';

const fs = require('fs');
const util = require('util');
const stream = require('stream');
const logger = require('winston');

const File = require('mongoose').model('File');
const quota = require('../../../src/common/quota');
const storage = require('../../modules/storage');
const error = require('../../modules/error')('storage', 'file');
const acl = require('../../../src/common/acl');
const api = require('../api/api');

/**
 * Downloads a single file.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Error} authErr Auth error if authentication failed so we can give more details for protected files.
 */
exports.get = function(req, res, authErr) {

	Promise.try(() => find(req, authErr)).spread((file, isFree) => {

		if (isFree) {
			return serve(req, res, file, req.params.variation);
		}

		// check the quota
		return quota.isAllowed(req, res, file).then(granted => {
			if (!granted) {
				throw error('No more quota left.').status(403).warn();
			}
			return serve(req, res, file, req.params.variation);
		});

	}).catch(api.handleError(res, error, 'Error serving file'));
};

/**
 * Checks if a file exists.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Error} authErr Auth error if authentication failed so we can give more details for protected files.
 */
exports.head = function(req, res, authErr) {

	Promise.try(() => find(req, authErr)).spread(file => {
		return serve(req, res, file, req.params.variation, true);

	}).catch(api.handleError(res, error, 'Error serving head'));
};


/**
 * Retrieves a storage item and does all checks but the quota check.
 *
 * @param {Request} req
 * @param {Error} authErr Auth error if authentication failed so we can give more details for protected files.
 * @return {Promise.<[ {File}, {boolean} ]>}
 */
function find(req, authErr) {

	let file;
	return Promise.try(() => {
		return File.findOne({ id: req.params.id }).exec();

	}).then(f => {
		file = f;

		if (!file) {
			throw error('No such file with ID "%s".', req.params.id).status(404);
		}

		let isPublic = file.isPublic(req.params.variation);

		// file is not public - user must be logged in.
		if (!isPublic && !req.user) {
			if (authErr) {
				throw error(authErr, 'You must provide valid credentials for non-public files.').status(401);
			} else {
				throw error('You must provide valid credentials for non-public files.').status(401);
			}
		}

		// if inactive and user is not logged or not the owner, refuse.
		if (!file.is_active) {
			if (!req.user) {
				throw error(authErr, 'You must provide credentials for inactive files.').status(401);
			}
			if (!file._created_by.equals(req.user._id)) {
				throw error('You must own inactive files in order to access them.').status(403);
			}
		}

		// at this point, we can serve the file if it's free
		if (isPublic) {
			return [ file, isPublic ];
		}

		// we also serve it if it's free and the user is logged
		if (file.isFree(req.params.variation) && req.user) {
			return [ file, isPublic ];
		}

		// so here we determined the file isn't free, so we need to check ACLs.
		return acl.isAllowed(req.user.id, 'files', 'download').then(granted => {

			if (!granted) {
				throw error('Your ACLs do not allow downloading of any files.').status(403);
			}

			// if the user is the owner, serve directly (owned files don't count as credits)
			if (file._created_by.equals(req.user._id)) {
				return [ file, true ];
			}
			return [ file, false ];
		});
	});
}


/**
 * Serves a file to the user.
 *
 * For wait-while-processing logic see explanations below.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 * @param {File} file File to serve
 * @param {string} variationName Name of the variation to serve
 * @param {boolean} [headOnly=false] If set, only send the headers but no content (for `HEAD` requests)
 */
function serve(req, res, file, variationName, headOnly) {

	return Promise.try(() => {

		// check if file is ready to stream or subscribes to callback otherwise
		return storage.fstat(file, variationName);

	}).then(fstat => {

		if (fstat && fstat.size > 0) {
			return fstat;

		} else {
			/*
			 * So the idea is the following:
			 *
			 * The user uploads let's say an image, a backglass at 1280x1024 that weights 2.5M. As uploading takes already
			 * long enough, we don't want the user wait another minute until the post-processing stuff is done (i.e.
			 * creating thumbs and running everything through pngquant and optipng).
			 *
			 * For this reason, when uploading, the API only reads image meta data and instantly returns the payload that
			 * contains URLs for not-yet-generated thumbs. The post-processing is then launched in the background.
			 *
			 * Now, when the client accesses the not-yet-generated thumb, we end up here. By calling `whenProcessed()`, we
			 * ask the `storage` module to let us know when processing for that file and variation has finished (if there
			 * wasn't actually any processing going on, it will instantly return null).
			 *
			 * That means that the client's request for the image is delayed until the image is ready and then instantly
			 * delivered.
			 *
			 * The client can also use the same mechanism if it just wants to wait and do something else by issueing a HEAD
			 * request on the resource, so no data is transferred.
			 */
			logger.info('[ctrl|storage] Waiting for %s to be processed...', file.toString(variationName));
			return new Promise((resolve, reject) => {
				storage.whenProcessed(file, variationName, (f, fstat) => {
					file = f;
					if (!fstat) {
						logger.info('[ctrl|storage] No processing or error, returning 404.');
						reject(error('Processing error, file not found.').status(404).log('serve'));
					}
					resolve(fstat);
				});
			});
		}

	}).then(fstat => {

		// Now serve the file!
		// -------------------

		// check if we should return 304 not modified
		const modified = new Date(fstat.mtime);
		const ifmodifiedsince = req.headers['if-modified-since'] ? new Date(req.headers['if-modified-since']) : false;
		if (ifmodifiedsince && modified.getTime() >= ifmodifiedsince.getTime()) {
			return api.success(res, null, 304);
		}

		// only return the header if request was HEAD
		if (headOnly) {
			return api.success(res, null, 200, { headers: {
				'Content-Type': file.getMimeType(variationName),
				'Content-Length': 0,
				'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
			} });
		}
		const filePath = file.getPath(variationName);

		// So seriously, fucking Node doesn't respect its own stupid callback conventions in fs.exists?
		// Callback is called with result only!
		return new Promise(resolve => {
			fs.exists(filePath, resolve);

		}).then(fileExists => {
			if (!fileExists) {
				logger.error('[ctrl|storage] Cannot find %s at "%s" in order to stream to client.', file.toString(variationName), filePath);
				throw error('Error streaming %s from storage. Please contact an admin.', file.toString(variationName)).log('serve');
			}

			return new Promise((resolve, reject) => {
				// create read stream
				let readStream;
				if (file.isLocked()) {
					logger.warn('[ctrl|storage] File is being processed, loading file into memory in order to free up file handle rapidly (%s).', file.getPath());
					readStream = new BufferStream(fs.readFileSync(filePath));
				} else {
					readStream = fs.createReadStream(filePath);
				}

				// configure stream
				readStream.on('error', err => {
					logger.error('[ctrl|storage] Error before streaming %s from storage: %s', file.toString(variationName), err);
					reject(err);
				});
				readStream.on('close', resolve);

				// set headers
				const headers = {
					'Content-Type': file.getMimeType(variationName),
					'Content-Length': fstat.size,
					'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
				};

				if (req.query.save_as) {
					headers['Content-Disposition'] = 'attachment; filename="' + file.name + '"';
				}

				// start streaming
				res.writeHead(200, headers);
				readStream.pipe(res)
					.on('error', err => {
						logger.error('[ctrl|storage] Error while streaming %s from storage: %s', file.toString(variationName), err);
						reject(err);
					});

			}).then(() => {
				logger.verbose('[ctrl|storage] File %s successfully served to <%s>.', file.toString(variationName), req.user ? req.user.email : 'anonymous');

				// count download
				if (!variationName) {
					return file.incrementCounter('downloads').then(() => {
						if (!file.isFree(variationName)) {
							return req.user.incrementCounter('downloads');
						}
					});
				}

			}).catch(() => res.end());
		});
	});
}

/**
 * A streamable buffer
 * @see http://www.bennadel.com/blog/2681-turning-buffers-into-readable-streams-in-node-js.htm
 * @param source Buffer to stream from
 * @constructor
 */
function BufferStream(source) {
	if (!Buffer.isBuffer(source)) {
		throw new Error('Source must be a buffer.');
	}
	stream.Readable.call(this);
	this._source = source;
	this._offset = 0;
	this._length = source.length;
	this.on('end', this._destroy);
}
util.inherits(BufferStream, stream.Readable);
BufferStream.prototype._destroy = function() {
	this._source = null;
	this._offset = null;
	this._length = null;
};
BufferStream.prototype._read = function(size) {
	if (this._offset < this._length) {
		this.push(this._source.slice(this._offset, ( this._offset + size )));
		this._offset += size;
	}
	if (this._offset >= this._length) {
		this.push(null);
	}
};