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
var path = require('path');
var async = require('async');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');

var uniqueValidator = require('mongoose-unique-validator');
var paginate = require('mongoose-paginate');

var toObj = require('./plugins/to-object');
var metrics = require('./plugins/metrics');
var fileRef = require('./plugins/file-ref');
var prettyId = require('./plugins/pretty-id');
var idValidator = require('./plugins/id-ref');
var sortableTitle = require('./plugins/sortable-title');

var fileModule = require('../modules/file');
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
	var ids = _.map(_.compact(_.pluck(_.flatten(_.pluck(this.versions, 'files')), '_file')), function(id) {
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

	var index = 0;
	var that = this;
	if (!_.isArray(files) || files.length === 0) {
		return callback(true);
	}
	var hasTableFile = false;
	var tableFiles = [];
	async.eachSeries(files, function(f, next) {

		if (f._file) {

			mongoose.model('File').findById(f._file, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.error('[model] Error fetching file "%s".', f._file);
					if (f.isNew) index++;
					return next();
				}
				if (!file) {
					// this is already validated by the file reference
					if (f.isNew) index++;
					return next();
				}

				// table checks
				if (file.getMimeCategory() === 'table') {

					hasTableFile = true;
					tableFiles.push({ file: f, index: index});

					// flavor
					var fileFlavor = f.flavor || {};
					_.each(fileFields.flavor, function(obj, flavor) {
						if (!fileFlavor[flavor]) {
							that.invalidate('files.' + index + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
						}
					});

					// compatibility (in here because it applies only to table files.)
					if (!_.isArray(f._compatibility) || !f._compatibility.length) {
						// TODO check if exists.
						that.invalidate('files.' + index + '._compatibility', 'At least one build must be provided.');
					}

					// media
					var hasPlayfieldImage = f._media && f._media.playfield_image;
					var hasPlayfieldScreenshot = file.variations && file.variations.screenshot;
					if (hasPlayfieldImage) {

						// check if exists
						mongoose.model('File').findById(f._media.playfield_image, function(err, playfieldImage) {
							/* istanbul ignore if */
							if (err) {
								logger.error('[model] Error fetching file "%s".', f._media.playfield_image);
								if (f.isNew) index++;
								return next();
							}
							if (!playfieldImage) {
								that.invalidate('files.' + index + '._media.playfield_image', 'Playfield "' + f._media.playfield_image + '" does not exist.');
								if (f.isNew) index++;
								return next();
							}
							if (!_.contains(['playfield-fs', 'playfield-ws'], playfieldImage.file_type)) {
								that.invalidate('files.' + index + '._media.playfield_image', 'Must reference a file with file_type "playfield-fs" or "playfield-ws".');
							}
							if (f.isNew) index++;
							next();
						});
					} else if (hasPlayfieldScreenshot) {

						logger.info('[model|release] Creating new playfield image from table screenshot...');
						var error = require('../modules/error')('model', 'file');
						var screenshotPath = file.getPath('screenshot');
						var fstat = fs.statSync(screenshotPath);
						var readStream = fs.createReadStream(screenshotPath);

						var fileData = {
							name: path.basename(screenshotPath, path.extname(screenshotPath)) + '.png',
							bytes: fstat.size,
							variations: {},
							created_at: new Date(),
							mime_type: file.variations.screenshot.mime_type,
							file_type: 'playfield-' + f.flavor.orientation,
							_created_by: file._created_by
						};

						fileModule.create(fileData, readStream, error, function(err, playfieldImageFile) {
							if (err) {
								logger.error('[model|release] Error creating playfield image from table file: ' + err.message);
								that.invalidate('files.' + index + '._media.playfield_image', 'Error processing screenshot: ' + err.message);
							} else {
								logger.info('[model|release] Playfield image successfully created.');
								f._media.playfield_image = playfieldImageFile._id;
							}
							if (f.isNew) index++;
							next();
						});

					} else {
						that.invalidate('files.' + index + '._media.playfield_image', 'Playfield image must be provided.');
						if (f.isNew) index++;
						return next();
					}

				} else {
					if (f.isNew) index++;
					next();
				}
			});
		} else {
			if (f.isNew) index++;
			next();
		}
	}, function() {

		if (!hasTableFile) {
			that.invalidate('files', 'At least one table file must be provided.');
		}
		var mapCompat = function(file) {
			// can be either exploded into object or just id.
			return !file._id ? file.toString() : file._id.toString();
		};

//		console.log('Checking %d table files for compat/flavor dupes:', _.keys(tableFiles).length);

		// validate existing compat/flavor combination
		_.each(tableFiles, function(f) {
			var file = f.file;

			if (!file.flavor || !file._compatibility) {
				return;
			}

			var fileFlavor = file.flavor.toObject();
			var fileCompat = _.map(file._compatibility, mapCompat);
			fileCompat.sort();

			var dupeFiles = _.filter(_.pluck(tableFiles, 'file'), function(otherFile) {

				if (file.id === otherFile.id) {
					return false;
				}
				var compat = _.map(otherFile._compatibility, mapCompat);
				compat.sort();

//				console.log('  File %s <-> %s', file.id, otherFile.id);
//				console.log('     compat %j <-> %j', fileCompat, compat);
//				console.log('     flavor %j <-> %j', fileFlavor, otherFile.flavor.toObject());

				return _.isEqual(fileCompat, compat) && _.isEqual(fileFlavor, otherFile.flavor.toObject());
			});

			if (file.isNew && dupeFiles.length > 0) {
//				console.log('     === FAILED ===');
				that.invalidate('files.' + f.index + '._compatibility', 'A combination of compatibility and flavor already exists with the same values.');
				that.invalidate('files.' + f.index + '.flavor', 'A combination of compatibility and flavor already exists with the same values.');
			}
		});

		callback(true);
	});
});


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.statics.toSimple = function(release, opts) {
	opts = opts || {};
	opts.flavor = opts.flavor || {};
	opts.thumb = opts.thumb || 'original';

	var i, j, file, thumb;
	var rls = _.pick(release.toObj ? release.toObj() : release, [ 'id', 'name', 'created_at', 'authors', 'counter' ]);

	rls.game = _.pick(release._game, ['id', 'title']);

	// if results comes from an aggregation, we don't have a model and need to call toObj manually...
	if (!release.toObj) {
		_.each(rls.authors, function(author) {
			AuthorSchema.options.toObject.transform(null, author);
		});
	}

	// sort versions by release date
	var versions = release.versions.sort(function(a, b) {
		var dateA = new Date(a.released_at).getTime();
		var dateB = new Date(b.released_at).getTime();
		if (dateA < dateB) { return 1; }
		if (dateA > dateB) { return -1; }
		return 0;
	});
	var latestVersion = versions[0];

	// get the file to pull media from
	var f, fileFlavor, flavorName, flavorValue, playfieldImage;
	var flavorParams = opts.thumbFlavor ? opts.thumbFlavor.split(',') : [];
	var defaults = flavor.defaultThumb();
	var weight, match, matches = [];
	for (i = 0; i < latestVersion.files.length; i++) {
		if (!latestVersion.files[i].flavor) {
			// skip non-table files
			continue;
		}
		file = latestVersion.files[i];
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

		matches.push({
			file: file,
			weight: weight
		});
	}
	matches = matches.sort(function(a, b) {
		if (a.weight < b.weight) { return 1; }
		if (a.weight > b.weight) { return -1; }
		return 0;
	});

	var thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
	if (opts.fullThumbData) {
		thumbFields = thumbFields.concat(['mime_type', 'bytes']);
	}
	for (i = 0; i < matches.length; i++) {
		match = matches[i].file;
//		console.log('[%s] =====> %j', release.id, match.flavor.toObj());
		playfieldImage = match._media.playfield_image.toObj ? match._media.playfield_image.toObj() : match._media.playfield_image;
		if (opts.thumb === 'original') {
			thumb = _.extend(_.pick(playfieldImage, thumbFields), {
				width: playfieldImage.metadata.size.width,
				height: playfieldImage.metadata.size.height
			});
			break;

		} else if (playfieldImage.variations[opts.thumb]) {
			thumb = _.pick(playfieldImage.variations[opts.thumb], thumbFields);
			break;

		} else {
//			console.log(playfieldImage);
//			console.log('[%s] no %s variation for playfield image, trying next best match.', release.id, opts.thumb);
		}
	}

	if (!thumb) {
		thumb = {
			url: playfieldImage.url,
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		};
		if (opts.fullThumbData) {
			thumb.mime_type = playfieldImage.mime_type;
			thumb.bytes = playfieldImage.bytes;
		}
	}

	if (opts.fullThumbData) {
		thumb.file_type = playfieldImage.file_type;
	}

	rls.latest_version = {
		version: latestVersion.version,
		thumb: {
			image: thumb,
			flavor: match.flavor
		},
		files: []
	};

	_.each(latestVersion.files, function(file) {
		rls.latest_version.files.push({
			released_at: file.released_at,
			flavor: file.flavor,
			compatibility: _.pluck(file._compatibility, 'id'),
			file: _.pick(file._file, ['id', 'name', 'bytes', 'mime_type'])
		});
	});

	return rls;
};

/**
 * Returns an aggregation pipeline that filters releases by nested conditions.
 *
 * @param {array} query Original, non-nested query
 * @param {array} filter Array of nested conditions, e.g. [ { "versions.files.flavor.lightning": "night" } ]
 * @param {int} [sortBy] Object defining the sort order
 * @param {int} [pagination] Pagination object
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
ReleaseSchema.methods.toDetailed = function() {
	return this.toObj();
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
		delete release.__v;
		delete release._id;
		delete release._created_by;
		delete release._tags;
		delete release._game;
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
		file.compatibility = [];
		_.each(file._compatibility, function(compat) {
			if (compat.label) {
				file.compatibility.push(Build.toSimple(compat));
			} else {
				file.compatibility.push({ _id: compat._id });
			}
		});
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
