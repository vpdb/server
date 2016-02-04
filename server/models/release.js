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
var path = require('path');
var async = require('async');
var logger = require('winston');
var shortId = require('shortid32');
var mongoose = require('mongoose');

var uniqueValidator = require('mongoose-unique-validator');
var paginate = require('mongoose-paginate');

var toObj = require('./plugins/to-object');
var metrics = require('./plugins/metrics');
var fileRef = require('./plugins/file-ref');
var prettyId = require('./plugins/pretty-id');
var idValidator = require('./plugins/id-ref');
var sortableTitle = require('./plugins/sortable-title');

var flavor = require('../modules/flavor');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

// FILES
var fileFields = {
	_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	flavor: {
		orientation: { type: String, 'enum': { values: flavor.keys('orientation'), message: 'Invalid orientation. Valid orientation are: ["' + flavor.keys('orientation').join('", "') + '"].' }},
		lighting:    { type: String, 'enum': { values: flavor.keys('lighting'), message: 'Invalid lighting. Valid options are: ["' + flavor.keys('lighting').join('", "') + '"].' }}
	},
	_compatibility: [ { type: Schema.ObjectId, ref: 'Build' } ],
	_media: {
		playfield_image: { type: Schema.ObjectId, ref: 'File' },
		playfield_video: { type: Schema.ObjectId, ref: 'File' }
	},
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, 'default': 0 }
	}
};
var FileSchema = new Schema(fileFields);
FileSchema.plugin(fileRef);
FileSchema.plugin(prettyId, { model: 'ReleaseVersionFile' });
FileSchema.plugin(toObj);

// VERSIONS
var versionFields = {
	version: { type: String, required: 'Version must be provided.' },
	released_at: { type: Date, required: true },
	changes: { type: String },
	files: { validate: [ nonEmptyArray, 'You must provide at least one file.' ], type: [ FileSchema ] },
	counter: {
		downloads: { type: Number, 'default': 0 },
		comments:   { type: Number, 'default': 0 }
	}
};
var VersionSchema = new Schema(versionFields);
VersionSchema.plugin(fileRef);
VersionSchema.plugin(prettyId, { model: 'ReleaseVersion' });
VersionSchema.plugin(toObj);

// AUTHOR
var AuthorSchema = new Schema({
	_user: { type: Schema.ObjectId, required: 'Reference to user must be provided.', ref: 'User' },
	roles: [ String ]
});
AuthorSchema.plugin(toObj);

// RELEASE
var releaseFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	_game:         { type: Schema.ObjectId, required: 'Reference to game must be provided.', ref: 'Game' },
	name:          { type: String, required: 'Name must be provided.' },
	name_sortable: { type: String, index: true },
	description:   { type: String },
	versions:      { type: [ VersionSchema ], validate: [ nonEmptyArray, 'You must provide at least one version for the release.' ] },
	authors:       { type: [ AuthorSchema ], validate: [ nonEmptyArray, 'You must provide at least one author.' ] },
	_tags:       [ { type: String, ref: 'Tag' } ],
	links: [ {
		label: { type: String },
		url: { type: String }
	} ],
	acknowledgements: { type: String },
	original_version: {
		_ref: { type: Schema.ObjectId, ref: 'Release' },
		release: {
			name: { type: String },
			url: { type: String }
		}
	},
	counter: {
		downloads: { type: Number, 'default': 0 },
		comments:  { type: Number, 'default': 0 },
		stars:     { type: Number, 'default': 0 }
	},
	metrics: {
		popularity: { type: Number, 'default': 0 } // time-decay based score like reddit, but based on views, downloads, comments, favs. see SO/11653545
	},
	rating: {
		average:   { type: Number, 'default': 0 },
		votes:     { type: Number, 'default': 0 },
		score:     { type: Number, 'default': 0 } // imdb-top-250-like score, a bayesian estimate.
	},
	modified_at:   { type: Date, required: true },
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, required: true, ref: 'User' }
};
var ReleaseSchema = new Schema(releaseFields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
ReleaseSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
ReleaseSchema.plugin(fileRef);
ReleaseSchema.plugin(prettyId, { model: 'Release', ignore: [ '_created_by', '_tags' ] });
ReleaseSchema.plugin(idValidator, { fields: [ '_tags' ] });
ReleaseSchema.plugin(paginate);
ReleaseSchema.plugin(toObj);
ReleaseSchema.plugin(metrics, { hotness: { popularity: { downloads: 10, comments: 20, stars: 30 }}});
ReleaseSchema.plugin(sortableTitle, { src: 'name', dest: 'name_sortable' });

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

ReleaseSchema.path('versions').validate(function(file) {
	var ids = _.map(_.compact(_.map(_.flatten(_.map(this.versions, 'files')), '_file')), function(id) {
		return id.toString();
	});
	if (_.uniq(ids).length !== ids.length) {
		this.invalidate('versions', 'You cannot reference a file multiple times.');
	}
	return true;
});

/**
 * Validates files.
 *
 * Note that individual files cannot be updated; they can only be added or
 * removed. Thus, we base the file index (i) on new items only.
 */
VersionSchema.path('files').validate(function(files, callback) {

	// ignore if no files set
	if (!_.isArray(files) || files.length === 0) {
		return Promise.resolve(true);
	}

	var hasTableFile = false;
	var tableFiles = [];
	return Promise.try(() => {

		var index = 0; // when updating a version, ignore existing files, so increment only if new
		return Promise.each(files, file => {
			return validateFile(this, file, index).then(isTableFile => {
				if (isTableFile) {
					hasTableFile = true;
					tableFiles.push({ file: file, index: index});
				}
				if (file.isNew) {
					index++;
				}
			});
		});

	}).then(() => {

		if (!hasTableFile) {
			this.invalidate('files', 'At least one table file must be provided.');
		}

		// can be either exploded into object or id only.
		var getIdFromFile = file => file._id ? file._id.toString() : file.toString();

//		console.log('Checking %d table files for compat/flavor dupes:', _.keys(tableFiles).length);

		// validate existing compat/flavor combination
		tableFiles.forEach(f => {
			let file = f.file;

			if (!file.flavor || !file._compatibility) {
				return;
			}

			var fileFlavor = file.flavor.toObject();
			var fileCompat = _.map(file._compatibility, getIdFromFile);
			fileCompat.sort();

			var dupeFiles = _.filter(_.map(tableFiles, 'file'), otherFile => {

				if (file.id === otherFile.id) {
					return false;
				}
				var compat = _.map(otherFile._compatibility, getIdFromFile);
				compat.sort();

//				console.log('  File %s <-> %s', file.id, otherFile.id);
//				console.log('     compat %j <-> %j', fileCompat, compat);
//				console.log('     flavor %j <-> %j', fileFlavor, otherFile.flavor.toObject());

				return _.isEqual(fileCompat, compat) && _.isEqual(fileFlavor, otherFile.flavor.toObject());
			});

			if (file.isNew && dupeFiles.length > 0) {
//				console.log('     === FAILED ===');
				this.invalidate('files.' + f.index + '._compatibility', 'A combination of compatibility and flavor already exists with the same values.');
				this.invalidate('files.' + f.index + '.flavor', 'A combination of compatibility and flavor already exists with the same values.');
			}
		});

	}).then(() => {
		callback(true);

	}).catch(err => {
		logger.error('[model|release] Error validating files! %s', err.message);
		logger.error(err.stack);
		callback(false);

	});
});

/**
 * Validates the given
 * @param release Where to apply the invalidations to
 * @param tableFile File to validate
 * @param {int} index Index of the file in the request body
 * @returns {Promise.<boolean>} Promise resolving in true if the file was a table file or false otherwise
 */
function validateFile(release, tableFile, index) {

	if (!tableFile._file) {
		return Promise.resolve(false);
	}

	return mongoose.model('File').findById(tableFile._file).then(file => {

		// will fail by reference plugin
		if (!file) {
			return false;
		}

		// don't care about anything else but table files
		if (file.getMimeCategory() !== 'table') {
			return false;
		}

		console.log(file);

		// flavor
		var fileFlavor = tableFile.flavor || {};
		_.each(fileFields.flavor, (obj, flavor) => {
			if (!fileFlavor[flavor]) {
				release.invalidate('files.' + index + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
			}
		});

		// validate compatibility (in here because it applies only to table files.)
		if (!_.isArray(tableFile._compatibility) || !tableFile._compatibility.length) {
			// TODO check if exists.
			release.invalidate('files.' + index + '._compatibility', 'At least one build must be provided.');
		} else if (tableFile._compatibility.length !== _.uniq(tableFile._compatibility.map(c => c.toString())).length) {
			release.invalidate('files.' + index + '._compatibility', 'Cannot link a build multiple times.');
		}

		// check if playfield image exists
		if (!tableFile._media || !tableFile._media.playfield_image) {
			release.invalidate('files.' + index + '._media.playfield_image', 'Playfield image must be provided.');
		}

		var mediaValidations = [];

		// validate playfield image
		if (tableFile._media && tableFile._media.playfield_image) {
			mediaValidations.push(mongoose.model('File').findById(tableFile._media.playfield_image).then(playfieldImage => {
				if (!playfieldImage) {
					release.invalidate('files.' + index + '._media.playfield_image',
						'Playfield "' + tableFile._media.playfield_image + '" does not exist.');
					return;
				}
				if (playfieldImage.file_type === 'playfield') {
					release.invalidate('files.' + index + '._media.playfield_image',
						'Either provide rotation parameters in query or use "playfield-fs" or "playfield-ws" in file_type.');

				} else if (!_.includes(['playfield-fs', 'playfield-ws'], playfieldImage.file_type)) {
					release.invalidate('files.' + index + '._media.playfield_image',
						'Must reference a file with file_type "playfield-fs" or "playfield-ws".');

				} else {

					// fail if table file is set to FS but provided playfield is not
					if (fileFlavor.orientation && fileFlavor.orientation === 'fs' && playfieldImage.file_type !== 'playfield-fs') {
						release.invalidate('files.' + index + '._media.playfield_image', 'Table file orientation is set ' +
							'to FS but playfield image is "' + playfieldImage.file_type + '".');
					}

					// fail if table file is set to WS but provided playfield is not
					if (fileFlavor.orientation && fileFlavor.orientation === 'ws' && playfieldImage.file_type !== 'playfield-ws') {
						release.invalidate('files.' + index + '._media.playfield_image', 'Table file orientation is set ' +
							'to WS but playfield image is "' + playfieldImage.file_type + '".');
					}

					// fail if playfield is set to FS but file's metadata say otherwise
					if (playfieldImage.file_type === 'playfield-fs' && playfieldImage.metadata.size.width > playfieldImage.metadata.size.height) {
						release.invalidate('files.' + index + '._media.playfield_image', 'Provided playfield is ' +
							playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
							' (portrait) when it really should be landscape.');
					}

					// fail if playfield is set to WS but file's metadata say otherwise
					if (playfieldImage.file_type === 'playfield-ws' && playfieldImage.metadata.size.width < playfieldImage.metadata.size.height) {
						release.invalidate('files.' + index + '._media.playfield_image', 'Provided playfield is ' +
							playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
							' (landscape) when it really should be portrait.');
					}
				}
			}));
		}

		// TODO validate playfield video
		if (tableFile._media && tableFile._media.playfield_video) {

			mediaValidations.push(Promise.resolve(() => console.log("TODO: Validate playfield video")));
		}

		return Promise.all(mediaValidations).then(() => true);
	});
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

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.statics.toSimple = function(release, opts) {
	opts = opts || {};
	opts.flavor = opts.flavor || {};

	// field visibility
	var gameFields = ['id', 'title', 'manufacturer', 'year'];
	var releaseFields = [ 'id', 'name', 'created_at', 'authors', 'counter', 'versions' ];
	var versionFields = [ 'version', 'released_at', 'files' ];
	var fileRefFields = [ 'released_at', 'flavor', 'compatibility', 'file' ];
	var fileFields = ['id', 'name', 'bytes', 'mime_type'];
	var compatFields = [ 'id' ];

	var rls = _.pick(release.toObj ? release.toObj() : release, releaseFields);

	rls.game = _.pick(release._game, gameFields);

	// if results comes from an aggregation, we don't have a model and need to call toObj manually...
	if (!release.toObj) {
		rls.authors.forEach(function(author) {
			AuthorSchema.options.toObject.transform(null, author);
		});
	}

	// sort versions by release date
	var sortedVersions = rls.versions.sort(function(a, b) {
		var dateA = new Date(a.released_at).getTime();
		var dateB = new Date(b.released_at).getTime();
		if (dateA < dateB) { return 1; }
		if (dateA > dateB) { return -1; }
		return 0;
	});

	var versions = stripFiles(sortedVersions, opts);

	// set thumb
	rls.thumb = getReleaseThumb(versions, opts);

	// set star
	if (!_.isUndefined(opts.starred)) {
		rls.starred = opts.starred;
	}

	// reduce/enhance data
	rls.versions = _.map(versions, function(version) {
		version = _.pick(version, versionFields);
		version.files = _.map(version.files, function(file) {
			let fields = [ '_file', '_compatibility' ];
			let compatibility = file.compatibility || file._compatibility;
			if (opts.thumbPerFile && opts.thumbFormat) {
				file.thumb = getFileThumb(file, opts);
				fields.push('thumb');
			}
			file = _.pick(file, [...fileRefFields, ...fields]);
			file.compatibility = _.map(compatibility, function(c) {
				return _.pick(c, compatFields);
			});
			file.file = _.pick(file.file || file._file, fileFields);
			delete file._file;
			delete file._compatibility;
			return file;
		});
		return version;
	});

	return rls;
};


/**
 * Returns an aggregation pipeline that filters releases by nested conditions.
 *
 * @param {Array} query Original, non-nested query
 * @param {Array} filter Array of nested conditions, e.g. [ { "versions.files.flavor.lightning": "night" } ]
 * @param {number} [sortBy] Object defining the sort order
 * @param {{defaultPerPage: Number, maxPerPage: Number, page: Number, perPage: Number}} [pagination] Pagination object
 */
ReleaseSchema.statics.getAggregationPipeline = function(query, filter, sortBy, pagination) {

	var q = makeQuery(query.concat(filter));
	var f = makeQuery(filter);

	var group1 = {};
	var group2 = {};
	var project1 = {};
	var project2 = {};

	_.each(releaseFields, function(val, field) {
		if (field != 'versions') {
			group1[field] = '$' + field;
			group2[field] = '$' + field;
			project1[field] = '$_id.' + field;
			project2[field] = '$_id.' + field;
		}
	});
	project1.versions = { };

	_.each(versionFields, function(val, field) {
		if (field != 'files') {
			group1['version_' + field] = '$versions.' + field;
			project1.versions[field] = '$_id.version_' + field;
		}
	});

	var pipe = [ { $match: q } ];
	if (sortBy) {
		pipe.push({ $sort: sortBy });
	}

	if (pagination) {
		pipe.push({ $skip: (pagination.page * pagination.perPage) - pagination.perPage });
		pipe.push({ $limit: pagination.perPage });
	}

	pipe = pipe.concat([

		{ $unwind: '$versions'},
		{ $unwind: '$versions.files'},
		{ $match: f },
		{ $group: { _id: _.extend(group1, {
				_id: '$_id',
				versionId: '$versions._id'
			}),
			files: { $push: '$versions.files' }
		} },
		{ $project: _.extend(project1, {
			_id: '$_id._id',
			versions: _.extend(project1.versions, {
				_id: '$_id.versionId',
				files: '$files'
			})
		}) },
		{ $group: { _id: _.extend(group2, {
				_id: '$_id'
			}),
			versions: { $push: '$versions' }
		} },
		{ $project: _.extend(project2, {
			_id: '$_id._id',
			versions: '$versions'
		}) }
	]);
	return pipe;
};

function makeQuery(query) {
	if (query.length === 0) {
		return {};
	} else if (query.length === 1) {
		return query[0];
	} else {
		return { $and: query };
	}
}


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.methods.toDetailed = function(opts) {
	var rls = this.toObj();

	opts = opts || {};
	if (opts.thumbFlavor || opts.thumbFormat) {
		rls.thumb = getReleaseThumb(rls.versions, opts);
	}

	// reduce/enhance data
	rls.versions = _.map(rls.versions, function(version) {
		version.files = _.map(version.files, function(file) {
			if (opts.thumbPerFile && opts.thumbFormat) {
				file.thumb = getFileThumb(file, opts);
				if (!opts.full) {
					delete file.media;
				}
			}
			return file;
		});
		return version;
	});

	if (opts.starredReleaseIds) {
		rls.starred = _.includes(opts.starredReleaseIds, this._id.toString());
	}

	return rls;
};

ReleaseSchema.methods.toSimple = function(opts) {
	return ReleaseSchema.statics.toSimple(this, opts);
};

ReleaseSchema.methods.toReduced = function() {
	var release = _.pick(this.toObj(), [ 'id', 'name', 'created_at' ]);
	if (this._game) {
		release.game = this._game.toReduced();
	}
	return release;
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
ReleaseSchema.pre('remove', function(next) {

	// remove linked comments
	mongoose.model('Comment').remove({ '_ref.release': this._id}).exec(next);
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
ReleaseSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, release) {
		release.tags = release._tags;
		release.game = _.pick(release._game, ['id', 'title', 'manufacturer', 'year']);
		delete release.__v;
		delete release._id;
		delete release._created_by;
		delete release._tags;
		delete release._game;
		if (_.isArray(release.links)) {
			release.links.forEach(function(link) {
				delete link._id;
				delete link.id;
			});
		}
	}
};
VersionSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, version) {
		delete version.id;
		delete version._id;
	}
};
FileSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, file) {
		var Build = require('mongoose').model('Build');
		var File = require('mongoose').model('File');
		file.media = file._media;
		file.compatibility = _.map(file._compatibility, compat =>
			compat.label ? Build.toSimple(compat) : { _id: compat._id }
		);
		file.file = File.toDetailed(file._file);
		delete file.id;
		delete file._id;
		delete file._file;
		delete file._media;
		delete file._compatibility;
	}
};
AuthorSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, author) {
		author.user = require('mongoose').model('User').toReduced(author._user);
		delete author.id;
		delete author._id;
		delete author._user;
	}
};

mongoose.model('Release', ReleaseSchema);
mongoose.model('ReleaseVersion', VersionSchema);
mongoose.model('ReleaseVersionFile', FileSchema);
logger.info('[model] Schema "Release" registered.');


/**
 * Returns the thumb object for the given options provided by the user.
 *
 * Basically it looks at thumbFlavor and thumbFormat and tries to return
 * the best match.
 * @param versions
 * @param opts
 * @returns {{image: *, flavor: *}}
 */
function getReleaseThumb(versions, opts) {

	opts.thumbFormat = opts.thumbFormat || 'original';

	var i, j, file, thumb;

	var f, fileFlavor, flavorName, flavorValue;
	var flavorParams = opts.thumbFlavor ? opts.thumbFlavor.split(',') : [];
	var defaults = flavor.defaultThumb();
	var weight, match, filesByWeight = [];

	// get all files
	var files = _.flatten(_.map(versions, 'files'));

	// find best matching flavor
	for (i = 0; i < files.length; i++) {
		if (!files[i].flavor) {
			// skip non-table files
			continue;
		}
		file = files[i];
		fileFlavor = file.flavor.toObj ? file.flavor.toObj() : file.flavor;
		weight = 0;

		for (j = 0; j < flavorParams.length; j++) {
			f = flavorParams[j].split(':');
			flavorName = f[0];
			flavorValue = f[1];

			// parameter match gets most weight.
			if (fileFlavor[flavorName] === flavorValue) {
				weight += Math.pow(10, (flavorParams.length - j + 1) * 3);

				// defaults match gets also weight, but less
			} else if (defaults[flavorName] === flavorValue) {
				weight += Math.pow(10, (flavorParams.length - j + 1));
			}
		}
//		console.log('[%s] %s / %j => %d', release.id, opts.thumbFlavor, fileFlavor, weight);
		filesByWeight.push({
			file: file,
			weight: weight
		});
	}
	filesByWeight = filesByWeight.sort(function(a, b) {
		if (a.weight < b.weight) { return 1; }
		if (a.weight > b.weight) { return -1; }
		return 0;
	});

	var selectedFlavor;
	for (i = 0; i < filesByWeight.length; i++) {
		thumb = getFileThumb(filesByWeight[i].file, opts);
		selectedFlavor = filesByWeight[i].file.flavor;
		if (thumb !== null) {
			break;
		}
	}

	if (!thumb) {
		thumb = getDefaultThumb(filesByWeight[0], opts);
		selectedFlavor = filesByWeight[0].file.flavor;
	}

	return {
		image: thumb,
		flavor: selectedFlavor
	};
}

function getFileThumb(file, opts) {

	var thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
	if (opts.fullThumbData) {
		thumbFields = thumbFields.concat(['mime_type', 'bytes', 'file_type']);
	}

	var playfieldImage = getPlayfieldImage(file);

	if (opts.thumbFormat === 'original') {
		return _.extend(_.pick(playfieldImage, thumbFields), {
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		});

	} else if (playfieldImage.variations[opts.thumbFormat]) {
		return _.pick(playfieldImage.variations[opts.thumbFormat], thumbFields);
	}/*else {
	 console.log(playfieldImage);
	 console.log('[%s] no %s variation for playfield image, trying next best match.', release.id, opts.thumbFormat);
	 }*/
	return null;
}

function getDefaultThumb(file, opts) {

	var playfieldImage = getPlayfieldImage(file);
	var thumb = {
		url: playfieldImage.url,
		width: playfieldImage.metadata.size.width,
		height: playfieldImage.metadata.size.height
	};
	if (opts.fullThumbData) {
		thumb.mime_type = playfieldImage.mime_type;
		thumb.bytes = playfieldImage.bytes;
		thumb.file_type = playfieldImage.file_type;
	}
	return thumb;
}

function getPlayfieldImage(file) {
	var media = file.media || file._media;
	return media.playfield_image.toObj ? media.playfield_image.toObj() : media.playfield_image;
}

/**
 * Takes a sorted list of versions and removes files that have a newer
 * flavor. Also removes empty versions.
 * @param versions
 * @param opts
 */
function stripFiles(versions, opts) {
	var i, j;
	var flavorValues, flavorKey, flavorKeys = {};

	for (i = 0; i < versions.length; i++) {
		for (j = 0; j < versions[i].files.length; j++) {

			// if file ids given, ignore flavor logic
			if (_.isArray(opts.fileIds)) {
				if (!_.includes(opts.fileIds, versions[i].files[j].file.id)) {
					versions[i].files[j] = null;
				}

				// otherwise, make sure we include only the latest flavor combination.
			} else {

				// if non-table file, skip
				if (!versions[i].files[j].flavor) {
					continue;
				}

				flavorValues = [];
				for (var key in flavor.values) {
					//noinspection JSUnfilteredForInLoop
					flavorValues.push(versions[i].files[j].flavor[key]);
				}
				flavorKey = flavorValues.join(':');

				// strip if already available
				if (flavorKeys[flavorKey]) {
					versions[i].files[j] = null;
				}
				flavorKeys[flavorKey] = true;
			}
		}

		versions[i].files = _.compact(versions[i].files);

		// remove version if no more files
		if (versions[i].files.length === 0) {
			versions[i] = null;
		}
	}
	return _.compact(versions);
}