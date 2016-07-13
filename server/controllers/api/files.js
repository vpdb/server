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

var _ = require('lodash');
var logger = require('winston');
var Busboy = require('busboy');

var api = require('./api');
var File = require('mongoose').model('File');
var Release = require('mongoose').model('Release');
var TableBlock = require('mongoose').model('TableBlock');

var fileModule = require('../../modules/file');
var error = require('../../modules/error')('api', 'file');

/**
 * End-point for uploading files. Data can be sent either as entire body or
 * as multipart, although only one file is allowed in a multipart body.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.upload = function(req, res) {

	return Promise.try(() => {

		// fail if no content type
		if (!req.headers['content-type']) {
			throw error('Header "Content-Type" must be provided.').status(422);
		}

		// fail if no file type
		if (!req.query.type) {
			throw error('Query parameter "type" must be provided.').status(422);
		}

		// stream either directly from req or user a multipart parser
		if (/multipart\/form-data/i.test(req.headers['content-type'])) {
			return handleMultipartUpload(req, error);
		} else {
			return handleUpload(req, error);
		}

	}).then(file => {

		api.success(res, file.toDetailed(), 201);

	}).catch(api.handleError(res, error, 'Error uploading file'));
};

/**
 * Deletes a file.
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var file;
	return Promise.try(() => {
		return File.findOne({ id: req.params.id });

	}).then(f => {
		file = f;

		// fail if not found
		if (!file) {
			throw error('No such file with ID "%s".', req.params.id).status(404);
		}

		// fail if not owner
		if (!file._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}

		// only allow inactive files (for now)
		if (file.is_active !== false) {
			throw error('Cannot remove active file.').status(400);
		}

		return file.remove();

	}).then(() => {

		logger.info('[api|file:delete] File "%s" (%s) successfully removed.', file.name, file.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting file'));

};

/**
 * Returns details of a given file.
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	return Promise.try(() => {
		return File.findOne({ id: req.params.id });

	}).then(file => {

		// fail if not found
		if (!file) {
			throw error('No such file with ID "%s".', req.params.id).status(404);
		}

		// fail if inactive and not owner
		var isOwner = req.user && file._created_by.equals(req.user._id);
		if (!file.is_active && (!req.user || !isOwner)) {
			throw error('File "%s" is inactive.', req.params.id).status(req.user ? 403 : 401);
		}

		api.success(res, file.toDetailed());

	}).catch(api.handleError(res, error, 'Error viewing file'));
};

/**
 * Looks for similar table files.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.blockmatch = function(req, res) {

	const rlsFields = '_game authors._user versions.files._file versions.files._compatibility';
	let file, blocks, matches;
	let result = { };
	return Promise.try(() => {
		return File.findOne({ id: req.params.id });

	}).then(f => {
		file = f;

		// fail if not found
		if (!file) {
			throw error('No such file with ID "%s".', req.params.id).status(404);
		}

		// fail if no table file
		if (file.getMimeCategory() !== 'table') {
			throw error('Can only match table files, this is a %s', file.getMimeCategory(), req.params.id).status(400);
		}
		return Release.findOne({ 'versions.files._file': file._id }).populate(rlsFields).exec();

	}).then(release => {

		// fail if not found
		if (!release) {
			throw error('Release reference missing.', req.params.id);
		}
		splitReleaseFile(release, file._id.toString(), result);

		return TableBlock.find({_files: file._id}).exec();

	}).then(b => {
		blocks = b;

		matches = new Map();
		// split blocks: { <file._id>: [ matched blocks ] }
		blocks.forEach(block => {
			block._files.forEach(f => {
				// don't match own id
				if (f.equals(file._id)) {
					return;
				}
				const fid = f.toString();
				if (!matches.has(fid)) {
					matches.set(fid, []);
				}
				matches.get(fid).push(block);
			});
		});
		return Release.find({ 'versions.files._file': { $in: Array.from(matches.keys()) }}).populate(rlsFields).exec();

	}).then(matchedReleases => {
		// map <file._id>: <release>
		let releases = new Map();
		matchedReleases.forEach(release => {
			release.versions.forEach(version => {
				version.files.forEach(file => {
					releases.set(file._file._id.toString(), release);
				});
			});
		});
		const totalBytes = _.sumBy(blocks, b => b.bytes);
		result.matches = [];
		for (let [key, matchedBlocks] of matches) {
			const matchedBytes = _.sumBy(matchedBlocks, b => b.bytes);
			let match = {
				matchedCount: matchedBlocks.length,
				matchedBytes: matchedBytes,
				countPercentage: matchedBlocks.length / blocks.length * 100,
				bytesPercentage: matchedBytes / totalBytes * 100
			};
			splitReleaseFile(releases.get(key), key, match);
			result.matches.push(match);
		}
		result.matches = _.sortBy(_.filter(result.matches, 'release'), m => -(m.countPercentage + m.bytesPercentage));
		api.success(res, result);

	}).catch(api.handleError(res, error, 'Error retrieving block matches for file'));
};

/**
 * Searches a file with a given ID within a release and updates
 * a given object with release, game, version and file.
 * @param {Release} release Release to search in
 * @param {string} fileId File ID to search for  (database _id as string)
 * @param {object} result Object to be updated
 */
function splitReleaseFile(release, fileId, result) {
	if (!release) {
		return;
	}
	let rls = release.toSimple();
	result.release = _.pick(rls, ['id', 'name', 'created_at', 'authors']);
	result.game = rls.game;
	release.versions.forEach(version => {
		version.files.forEach(versionFile => {
			if (versionFile._file._id.toString() === fileId) {
				result.version = _.pick(version.toObject(), ['version', 'released_at']);
				let f = versionFile.toObject();
				result.file = _.pick(f, ['released_at', 'flavor' ]);
				result.file.compatibility = f.compatibility.map(c => _.pick(c, ['id', 'label' ]));
				result.file.file = versionFile._file.toSimple();
			}
		});
	});
}

/**
 * Handles uploaded data posted as-is with a content type
 * @param {Request} req
 * @param {function} error Current error function
 * @returns {Promise.<FileSchema>}
 */
function handleUpload(req, error) {

	return Promise.try(() => {

		if (!req.headers['content-disposition']) {
			throw error('Header "Content-Disposition" must be provided.').status(422);
		}
		if (!/filename=([^;]+)/i.test(req.headers['content-disposition'])) {
			throw error('Header "Content-Disposition" must contain file name.').status(422);
		}
		var fileData = {
			name: req.headers['content-disposition'].match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, ''),
			bytes: req.headers['content-length'],
			variations: {},
			created_at: new Date(),
			mime_type: req.headers['content-type'],
			file_type: req.query.type,
			_created_by: req.user._id
		};

		return fileModule.create(fileData, req, error, { processInBackground: true });
	});
}

/**
 * Handles uploaded data posted as multipart.
 * @param {Request} req
 * @param {function} error Current error function
 * @returns {Promise.<FileSchema>}
 */
function handleMultipartUpload(req, error) {

	return Promise.try(() => {

		if (!req.query.content_type) {
			throw error('Mime type must be provided as query parameter "content_type" when using multipart.').status(422);
		}

		var busboy = new Busboy({ headers: req.headers });
		var parseResult = new Promise(function(resolve, reject) {

			var numFiles = 0;
			busboy.on('file', function(fieldname, stream, filename) {
				numFiles++;
				if (numFiles > 1) {
					return reject(error('Multipart requests must only contain one file.').status(422));
				}
				var fileData = {
					name: filename,
					bytes: 0,
					variations: {},
					created_at: new Date(),
					mime_type: req.query.content_type,
					file_type: req.query.type,
					_created_by: req.user._id
				};
				fileModule.create(fileData, stream, error, { processInBackground: true }).then(file => resolve(file)).catch(reject);
			});
		});

		var parseMultipart = new Promise((resolve, reject) => {
			busboy.on('finish', resolve);
			busboy.on('error', reject);
			req.pipe(busboy);
		});

		return Promise.all([parseResult, parseMultipart]).then(results => results[0]);
	});
}
