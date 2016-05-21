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
var fs = require('fs');
var gm = require('gm');
var util = require('util');
var async = require('async');
var logger = require('winston');

var Release = require('mongoose').model('Release');
var Version = require('mongoose').model('ReleaseVersion');
var VersionFile = require('mongoose').model('ReleaseVersionFile');
var LogEvent = require('mongoose').model('LogEvent');
var Build = require('mongoose').model('Build');
var Game = require('mongoose').model('Game');
var Star = require('mongoose').model('Star');
var Tag = require('mongoose').model('Tag');
var File = require('mongoose').model('File');
var api = require('./api');

var error = require('../../modules/error')('api', 'release');
var flavor = require('../../modules/flavor');
var pusher = require('../../modules/pusher');
var storage = require('../../modules/storage');

Promise.promisifyAll(gm.prototype);

/**
 * Creates a new release.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.create = function(req, res) {

	var now = new Date();
	var release;
	Promise.try(() => {

		// defaults
		if (req.body.versions) {
			req.body.versions.forEach(function(version) {
				version.released_at = version.released_at || now.toISOString();
				if (version.files) {
					var releasedAt = version.released_at || now.toISOString();
					version.files.forEach(function(file) {
						file.released_at = file.released_at || releasedAt;
					});
				}
			});
		}

		logger.info('[api|release:create] Body: %s', util.inspect(req.body, { depth: null }));
		return Release.getInstance(_.extend(req.body, {
			_created_by: req.user._id,
			modified_at: now,
			created_at: now
		}));

	}).then(newRelease => {
		release = newRelease;
		return preprocess(req, newRelease.getFileIds());

	}).then(() => {
		return release.validate();

	}).then(() => {
		logger.info('[api|release:create] Validations passed.');
		return release.save();

	}).then(() => {
		return postprocess(release.getPlayfieldImageIds());

	}).then(() => {
		logger.info('[api|release:create] Release "%s" created.', release.name);
		return release.activateFiles();

	}).then(() => {
		logger.info('[api|release:create] All referenced files activated, returning object to client.');

		// update counters and date
		return release.populate('_game').execPopulate()
			.then(release => release._game.incrementCounter('releases'))
			.then(() => release._game.update({ modified_at: new Date() }));

	}).then(() => {
		return getDetails(release._id);

	}).then(release => {

		LogEvent.log(req, 'create_release', true, {
			release: _.pick(release.toSimple(), [ 'id', 'name', 'authors', 'versions' ]),
			game: _.pick(release._game.toSimple(), [ 'id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type' ])
		}, {
			release: release._id,
			game: release._game._id
		});

		api.success(res, release.toDetailed(), 201);

	}).catch(api.handleError(res, error, 'Error creating release'));
};

/**
 * Updates the release data (only basic data, no versions or files).
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.update = function(req, res) {

	var updateableFields = [ 'name', 'description', '_tags', 'links', 'acknowledgements', 'authors' ];

	Promise.try(() => {

		return Release.findOne({ id: req.params.id });

	}).then(release => {

		// fail if invalid id
		if (!release) {
			throw error('No such release with ID "%s".', req.params.id).status(404).log('update');
		}

		// fail if wrong user
		var authorIds = _.map(_.map(release.authors, '_user'), id => id.toString());
		if (!_.includes(authorIds.concat(release._created_by.toString()), req.user._id.toString())) {
			throw error('Only authors of the release can update it.').status(403).log('update');
		}
		if (!_.isUndefined(req.body.authors) && release._created_by.toString() !== req.user._id.toString()) {
			throw error('Only the original uploader can edit authors.').status(403).log('update');
		}

		// fail if invalid fields provided
		var submittedFields = _.keys(req.body);
		if (_.intersection(updateableFields, submittedFields).length !== submittedFields.length) {
			var invalidFields = _.difference(submittedFields, updateableFields);
			throw error('Invalid field%s: ["%s"]. Allowed fields: ["%s"]', invalidFields.length === 1 ? '' : 's', invalidFields.join('", "'), updateableFields.join('", "')).status(400).log('update');
		}

		// apply changes
		return release.updateInstance(req.body);

	}).then(release => {

		// validate and save
		return release.validate().then(() => release.save());

	}).then(release => {

		// re-fetch release object tree
		return getDetails(release._id);

	}).then(release => {

		api.success(res, release.toDetailed(), 200);

		// log event
		LogEvent.log(req, 'update_release', false,
			{ release: req.body },
			{ release: release._id, game: release._game }
		);

	}).catch(api.handleError(res, error, 'Error updating release'));
};

/**
 * Adds a new version to an existing release.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.addVersion = function(req, res) {

	var now = new Date();
	var release, newVersion;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id }).exec();

	}).then(r => {
		release = r;

		// fail if release doesn't exist
		if (!release) {
			throw error('No such release with ID "%s".', req.params.id).status(404);
		}

		// fail if wrong user
		var authorIds = _.map(_.map(release.authors, '_user'), id => id.toString());
		if (!_.includes([release._created_by.toString(), ...authorIds], req.user._id.toString())) {
			throw error('Only authors of the release can update add new versions.').status(403).log('addVersion');
		}

		// set defaults
		var versionObj = _.defaults(req.body, { released_at: now });
		if (versionObj.files) {
			versionObj.files.forEach(function(file) {
				_.defaults(file, { released_at: now });
			});
		}

		// create instance
		logger.info('[api|release:addVersion] body: %s', util.inspect(versionObj, { depth: null }));
		return Version.getInstance(versionObj);

	}).then(v => {
		newVersion = v;
		return preprocess(req, newVersion.getFileIds());

	}).then(() => {

		logger.info('[api|release:addVersion] model: %s', util.inspect(newVersion, { depth: null }));
		var validationErr;
		return newVersion.validate().catch(err => validationErr = err).finally(() => {
			// validate existing version here
			if (_.filter(release.versions, { version: newVersion.version }).length > 0) {
				validationErr = validationErr || {};
				validationErr.errors = [{ path: 'version', message: 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.', value: newVersion.version }];
			}
			if (validationErr) {
				throw error('Validations failed. See below for details.').errors(validationErr.errors).warn('create').status(422);
			}
		});

	}).then(() => {
		release.versions.push(newVersion);
		release.modified_at = now;

		logger.info('[api|release:addVersion] Validations passed, adding new version to release.');
		return release.save();

	}).then(r => {
		release = r;
		return postprocess(newVersion.getPlayfieldImageIds());

	}).then(() => {
		logger.info('[api|release:create] Added version "%s" to release "%s".', newVersion.version, release.name);
		// set media to active
		return release.activateFiles();

	}).then(() => {

		// game modification date
		return Game.update({ _id: release._game.toString() }, { modified_at: now });

	}).then(() => {
		logger.info('[api|release:create] All referenced files activated, returning object to client.');
		return getDetails(release._id);

	}).then(release => {

		api.success(res, _.filter(release.toDetailed().versions, { version: newVersion.version })[0], 201);

		// do the rest async
		LogEvent.log(req, 'create_release_version', true, {
			release: _.pick(release.toSimple(), [ 'id', 'name', 'authors', 'versions' ]),
			game: _.pick(release._game.toSimple(), [ 'id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type' ])
		}, {
			release: release._id,
			game: release._game._id
		});
		pusher.addVersion(release._game, release, newVersion);

	}).catch(api.handleError(res, error, 'Error updating release'));
};

/**
 * Updates an existing version.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.updateVersion = function(req, res) {

	const updateableFields = [ 'released_at', 'changes' ];
	const updateableFileFields = [ 'flavor', '_compatibility', '_media' ];
	const now = new Date();

	let release, version, newFiles;
	let releaseToUpdate, versionToUpdate;
	Promise.try(() => {
		// retrieve release
		return Release.findOne({ id: req.params.id })
			.populate('versions.files._compatibility')
			.populate('versions.files._file')
			.exec();

	}).then(r => {
		release = r;

		// fail if no release
		if (!release) {
			throw error('No such release with ID "%s".', req.params.id).status(404);
		}

		// fail if wrong user
		let authorIds = _.map(_.map(release.authors, '_user'), id => id.toString());
		if (!_.includes([release._created_by.toString(), ...authorIds], req.user._id.toString())) {
			throw error('Only authors of the release can update or add new versions.').status(403).log('addVersion');
		}

		version = _.find(release.versions, { version: req.params.version });
		if (!version) {
			throw error('No such version "%s" for release "%s".', req.params.version, req.params.id).status(404);
		}

		// retrieve release with no references that we can update
		return Release.findOne({ id: req.params.id }).exec();

	}).then(r => {
		releaseToUpdate = r;
		versionToUpdate = _.find(releaseToUpdate.versions, { version: req.params.version });

		newFiles = [];
		logger.info('[api|release:updateVersion] %s', util.inspect(req.body, { depth: null }));

		return Promise.each(req.body.files || [], fileObj => {

			// check if file reference is already part of this version
			let existingVersionFile = _.find(version.files, f => f._file.id === fileObj._file);
			if (existingVersionFile) {
				let versionFileToUpdate = _.find(versionToUpdate.files, f => f._id.equals(existingVersionFile._id));
				return versionFileToUpdate.updateInstance(_.pick(fileObj, updateableFileFields));

			} else {
				_.defaults(fileObj, { released_at: now });
				return VersionFile.getInstance(fileObj).then(newVersionFile => {
					versionToUpdate.files.push(newVersionFile);
					newFiles.push(newVersionFile);
				});
			}
		});

	}).then(() => {
		return preprocess(req, version.getFileIds().concat(version.getFileIds(newFiles)));

	}).then(() => {

		// assign fields and validate
		Object.assign(versionToUpdate, _.pick(req.body, updateableFields));
		return releaseToUpdate.validate();

	}).then(() => {

		logger.info('[api|release:updateVersion] Validations passed, updating version.');
		releaseToUpdate.modified_at = now;
		return releaseToUpdate.save();

	}).then(r => {
		release = r;
		return postprocess(version.getPlayfieldImageIds());

	}).then(() => {

		if (newFiles.length > 0) {
			logger.info('[api|release:updateVersion] Added new file to version "%s" to release "%s".', version.version, release.name);
		}
		return Promise.all(newFiles, file => file.activateFiles());

	}).then(() => {
		logger.info('[api|release:create] All referenced files activated, returning object to client.');
		return Game.update({ _id: release._game.toString() }, { modified_at: new Date() });

	}).then(() => {

		return Release.findOne({ id: req.params.id })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._media.playfield_image' })
			.populate({ path: 'versions.files._media.playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

	}).then(release => {
		let version = _.find(release.toDetailed().versions, { version: req.params.version });
		api.success(res, version, 200);

	}).catch(api.handleError(res, error, 'Error updating version', /^versions\.\d+\./));
};

/**
 * Lists all releases.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.list = function(req, res) {

	let pagination = api.pagination(req, 12, 60);
	let query = [];
	let filter = [];
	let fileIds = null;
	let stars = null;
	let starMap = new Map();
	let titleRegex = null;
	let transformOpts = {};

	Promise.try(() => {

		// flavor, thumb selection
		if (req.query.thumb_flavor) {
			transformOpts.thumbFlavor = req.query.thumb_flavor;
			// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
		}
		if (req.query.thumb_format) {
			transformOpts.thumbFormat = req.query.thumb_format;
		}
		transformOpts.fullThumbData = parseBoolean(req.query.thumb_full_data);
		transformOpts.thumbPerFile = parseBoolean(req.query.thumb_per_file);

		// check
		if (transformOpts.thumbPerFile && !transformOpts.thumbFormat) {
			throw error('You must specify "thumb_format" when requesting thumbs per file.').status(400);
		}

		// filter by tag
		if (req.query.tags) {
			let t = req.query.tags.split(',');
			// all tags must be matched
			for (let i = 0; i < t.length; i++) {
				query.push({_tags: {$in: [t[i]]}});
			}
		}

		// filter by release id
		if (req.query.ids) {
			let ids = req.query.ids.split(',');
			query.push({id: {$in: ids}});
		}

		// filter by query
		if (req.query.q) {

			if (req.query.q.trim().length < 3) {
				throw error('Query must contain at least two characters.').status(400);
			}

			// sanitize and build regex
			let titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
			titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			let idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			let q = {
				'counter.releases': { $gt: 0 },
				$or: [ { title: titleRegex }, { id: idQuery } ]
			};
			return Game.find(q, '_id').exec().then(games => {
				let gameIds = _.map(games, '_id');
				if (gameIds.length > 0) {
					query.push({ $or: [ { name: titleRegex }, { '_game': { $in: gameIds } } ] });
				} else {
					query.push({ name: titleRegex });
				}
			});
		}

	}).then(() => {

		// user starred status
		if (req.user) {
			return Star.find({ type: 'release', _from: req.user._id }, '_ref.release').exec().then(starsResult => {
				stars = _.map(starsResult, '_ref.release').map(id => id.toString());
			});
		}

	}).then(() => {

		// starred filter
		if (!_.isUndefined(req.query.starred)) {

			if (!req.user) {
				throw error('Must be logged when listing starred releases.').status(401);
			}
			if (req.query.starred === "false") {
				query.push({ _id: { $nin: stars } });
			} else {
				query.push({ _id: { $in: stars } });
			}
		}

		// compat filter
		if (!_.isUndefined(req.query.builds)) {
			let buildIds = req.query.builds.split(',');
			return Build.find({ id: { $in: buildIds }}).exec().then(builds => {
				query.push({ 'versions.files._compatibility': { $in: _.map(builds, '_id') }});
			});
		}

	}).then(() => {

		// file size filter
		let filesize = parseInt(req.query.filesize, 10);
		if (filesize) {
			let threshold = parseInt(req.query.threshold, 10);
			let q = { file_type: 'release' };
			if (threshold) {
				q.bytes = { $gt: filesize - threshold, $lt: filesize + threshold };
			} else {
				q.bytes = filesize;
			}
			return File.find(q).exec().then(files => {
				if (files && files.length > 0) {
					fileIds = _.map(files, 'id');
					query.push({ 'versions.files._file': { $in: _.map(files, '_id') }});
				} else {
					query.push({ _id: null }); // no result
				}
			});
		}

	}).then(() => {

		// inner filters
		if (!_.isUndefined(req.query.flavor)) {
			req.query.flavor.split(',').forEach(f => {
				let kv = f.split(':');
				let k = kv[0].toLowerCase();
				let v = kv[1].toLowerCase();
				if (flavor.values[k]) {
					let fltr = {};
					fltr['versions.files.flavor.' + k] = { $in: [ 'any', v ]};
					filter.push(fltr);
				}
			});
		}

		if (stars) {
			stars.forEach(id => starMap.set(id, true));
		}

		let sort = api.sortParams(req, { modified_at: 1 }, {
			modified_at: '-modified_at',
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			name: 'name_sortable',
			num_downloads: '-counter.downloads',
			num_comments: '-counter.comments',
			num_stars: '-counter.stars'
		});
		let populatedFields = [ '_game', 'versions.files._file', 'versions.files._media.playfield_image',
		                        'versions.files._compatibility', 'authors._user' ];

		if (filter.length > 0) {
			let aggr = Release.getAggregationPipeline(query, filter, sort, pagination);
//			console.log(util.inspect(aggr, { depth: null, colors: true}));
			return Release.aggregate(aggr).exec().then(result => {
				// populate
				return Release.populate(result, populatedFields);

			}).then(releases => {
				// still need to count
				return Release.count(query).exec().then(count => [ releases, count ]);
			});

		} else {

			let q = api.searchQuery(query);
			logger.info('[api|release:list] query: %s, sort: %j', util.inspect(q), util.inspect(sort));
			return Release.paginate(q, {
				page: pagination.page,
				limit: pagination.perPage,
				populate: populatedFields,
				sort: sort  // '_game.title', '_game.id'
			}).then(result => [ result.docs, result.total ]);
		}

	}).spread((results, count) => {

		let releases = results.map(release => {
			if (stars) {
				transformOpts.starred = starMap.get(release._id.toString()) ? true : false;
			}
			transformOpts.fileIds = fileIds;
			return Release.toSimple(release, transformOpts);
		});

		api.success(res, releases, 200, api.paginationOpts(pagination, count));

	}).catch(api.handleError(res, error, 'Error listing releases'));
};

/**
 * Lists a release of a given ID.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.view = function(req, res) {

	Promise.try(() => {
		return Release.findOne({ id: req.params.id })
			.populate({ path: '_game' })
			.populate({ path: '_tags' })
			.populate({ path: '_created_by' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._media.playfield_image' })
			.populate({ path: 'versions.files._media.playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

	}).then(release => {
		if (!release) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}

		release.incrementCounter('views');

		var transformOpts = {};
		if (req.query.thumb_flavor) {
			transformOpts.thumbFlavor = req.query.thumb_flavor;
			// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
		}
		if (req.query.thumb_format) {
			transformOpts.thumbFormat = req.query.thumb_format;
		}

		transformOpts.thumbPerFile = parseBoolean(req.query.thumb_per_file);
		transformOpts.full = parseBoolean(req.query.full);

		return api.success(res, release.toDetailed(transformOpts));

	}).catch(api.handleError(res, error, 'Error retrieving release details'));
};

/**
 * Deletes a release.
 *
 * @param {"express".e.Request} req
 * @param {"express".e.Response} res
 */
exports.del = function(req, res) {

	let release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id })
			.populate({ path: 'versions.0.files.0._file' })
			.populate({ path: 'versions.0.files.0._media.playfield_image' })
			.populate({ path: 'versions.0.files.0._media.playfield_video' })
			.exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s".', req.params.id).status(404);
		}

		// only allow deleting own files (for now)
		if (!release._created_by.equals(req.user._id)) {
			throw error('Permission denied, must be owner.').status(403);
		}

		// remove from db
		return release.remove();

	}).then(() => {
		logger.info('[api|release:delete] Release "%s" (%s) successfully deleted.', release.name, release.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting release'));
};

/**
 * Retrieves release details.
 * @param id Database ID of the release to fetch
 * @returns {Promise.<Release>}
 */
function getDetails(id) {
	return Release.findById(id)
		.populate({ path: '_game' })
		.populate({ path: '_tags' })
		.populate({ path: '_created_by' })
		.populate({ path: 'authors._user' })
		.populate({ path: 'versions.files._file' })
		.populate({ path: 'versions.files._media.playfield_image' })
		.populate({ path: 'versions.files._media.playfield_video' })
		.populate({ path: 'versions.files._compatibility' })
		.exec();
}

/**
 * Pre-processes stuff before running validations.
 *
 * Currently, the only "stuff" is rotation of referenced media.
 * @param {"express".e.Request} req
 * @param {string[]} allowedFileIds Database IDs of file IDs of the current release that are allowed to be preprocessed.
 * @returns {Promise}
 */
function preprocess(req, allowedFileIds) {

	if (req.query.rotate) {

		// validate input format
		let rotations = req.query.rotate.split(',').map(r => {
			if (!r.includes(':')) {
				throw error('When providing the "rotation" query, pairs must be separated by ":".', req.params.id).status(400);
			}
			let rot = r.split(':');

			if (!_.includes(['0', '90', '180', '270'], rot[1])) {
				throw error('Wrong angle "%s", must be one of: [0, 90, 180, 270].', rot[1]).status(400);
			}
			return { file: rot[0], angle: parseInt(rot[1], 10) };
		});

		//let releaseMediaFileIds = [];
		//req.body.file

		// validate input data
		return Promise.each(rotations, rotation => {
			let file;
			return File.findOne({ id: rotation.file }).then(f => {
				file = f;
				if (!file) {
					throw error('Cannot rotate non-existing file "%s".', rotation.file).status(404);
				}

				if (!_.includes(allowedFileIds, file._id.toString())) {
					throw error('Cannot rotate file %s because it is not part of the release (%s).', file.id, file._id).status(400);
				}
				if (file.getMimeCategory() !== 'image') {
					throw error('Can only rotate images, this is a "%s".', file.getMimeCategory()).status(400);
				}
				if (!_.includes(['playfield', 'playfield-fs', 'playfield-ws'], file.file_type)) {
					throw error('Can only rotate playfield images, got "%s".', file.file_type).status(400);
				}
				return backupFile(file);

			// do the actual rotation
			}).then(src => {

				if (rotation.angle === 0) {
					return;
				}
				file.preprocessed = file.preprocessed || {};
				file.preprocessed.rotation = file.preprocessed.rotation || 0;
				file.preprocessed.unvalidatedRotation = (file.preprocessed.rotation + rotation.angle + 360) % 360;

				logger.info('[api|release] Rotating file "%s" %s° (was %s° before, plus %s°).', file.id, file.preprocessed.unvalidatedRotation, file.preprocessed.rotation, rotation.angle);
				return gm(src).rotate('black', file.preprocessed.unvalidatedRotation).writeAsync(file.getPath());

			// update metadata
			}).then(() => {
				return storage.metadata(file);

			// now patch new metadata and also file_type.
			}).then(metadata => {
				File.sanitizeObject(metadata);
				file.metadata = metadata;
				file.file_type = 'playfield-' + (metadata.size.width > metadata.size.height ? 'ws' : 'fs');
				return file.save();
			});
		});
	}
}

/**
 * Runs post-processing on stuff that was pre-processed earlier (and probably
 * needs to be post-processed again).
 *
 * @param {string[]} fileIds Database IDs of the files to re-process.
 * @returns {Promise}
 */
function postprocess(fileIds) {
	logger.info('[api|release] Post-processing files [ %s ]', fileIds.join(', '));
	return Promise.each(fileIds, id => {
		return Promise.try(() => {
			return File.findById(id).exec();
		}).then(file => {
			// so now we're here and unvalidatedRotation is now validated.
			if (file.preprocessed && file.preprocessed.unvalidatedRotation) {
				logger.info('[api|release] Validation passed, setting rotation to %s°', file.preprocessed.unvalidatedRotation);
				file.preprocessed.rotation = file.preprocessed.unvalidatedRotation;
				delete file.preprocessed.unvalidatedRotation;
				return file.save();
			}
			return file;
		}).then(file => {
			return storage.postprocess(file, false, true);
		});
	});
}

/**
 * Copies a file to a backup location (if not already done) and returns
 * the file name of the location.
 *
 * @param file File
 * @returns {Promise.<string>} New location
 */
function backupFile(file) {
	let backup = file.getPath(null, '_original');
	if (!fs.existsSync(backup)) {
		logger.info('[api|release] Copying "%s" to "%s".', file.getPath(), backup);
		return copyFile(file.getPath(), backup);
	}
	return Promise.resolve(backup);
}

/**
 * Copies a file on the file system. (Yes, NodeJS doesn't provide this out
 * of the box.)
 *
 * @param source Path to source file
 * @param target Path to target file
 * @returns {Promise.<string>} Path to target file
 */
function copyFile(source, target) {

	return new Promise((resolve, reject) => {
		let rd = fs.createReadStream(source);
		rd.on("error", err => {
			/* istanbul ignore next */
			reject(err);
		});
		let wr = fs.createWriteStream(target);
		wr.on("error", err => {
			/* istanbul ignore next */
			reject(err);
		});
		wr.on("close", () => {
			resolve(target);
		});
		rd.pipe(wr);
	});
}

/**
 * Parses a boolean value provided by the request
 * @param {string} value Value to parse
 * @returns {boolean}
 */
function parseBoolean(value) {
	return !_.isUndefined(value) && value.toLowerCase() !== 'false';
}

// playfield-from-server creation code (move to controller when tom's service is back up)
//logger.info('[model|release] Creating new playfield image from table screenshot...');
//var error = require('../modules/error')('model', 'file');
//var screenshotPath = file.getPath('screenshot');
//var fstat = fs.statSync(screenshotPath);
//var readStream = fs.createReadStream(screenshotPath);
//
//var fileData = {
//	name: path.basename(screenshotPath, path.extname(screenshotPath)) + '.png',
//	bytes: fstat.size,
//	variations: {},
//	created_at: new Date(),
//	mime_type: file.variations.screenshot.mime_type,
//	file_type: 'playfield-' + f.flavor.orientation,
//	_created_by: file._created_by
//};
//
//fileModule.create(fileData, readStream, error, function(err, playfieldImageFile) {
//	if (err) {
//		logger.error('[model|release] Error creating playfield image from table file: ' + err.message);
//		that.invalidate('files.' + index + '._media.playfield_image', 'Error processing screenshot: ' + err.message);
//	} else {
//		logger.info('[model|release] Playfield image successfully created.');
//		f._media.playfield_image = playfieldImageFile._id;
//	}
//	if (f.isNew) index++;
//	next();
//});
