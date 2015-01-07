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
var async = require('async');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');

var uniqueValidator = require('mongoose-unique-validator');
var paginate = require('mongoose-paginate');

var prettyId = require('./plugins/pretty-id');
var fileRef = require('./plugins/file-ref');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

var fileFields = {
	_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	flavor: {
		orientation: { type: String, enum: { values: [ 'ws', 'fs' ], message: 'Invalid orientation. Valid orientation are: ["ws", "fs"].' }},
		lightning:   { type: String, enum: { values: [ 'day', 'night' ], message: 'Invalid lightning. Valid options are: ["day", "night"].' }}
	},
	_compatibility: [ { type: Schema.ObjectId, ref: 'VPBuild' } ],
	_media: {
		playfield_image: { type: Schema.ObjectId, ref: 'File' },
		playfield_video: { type: Schema.ObjectId, ref: 'File' }
	}
};
var FileSchema = new Schema(fileFields);

var VersionSchema = new Schema({
	version: { type: String, required: 'Version must be provided.' },
	released_at: { type: Date, required: true },
	changes: { type: String },
	files: { validate: [ nonEmptyArray, 'You must provide at least one file.' ], type: [ FileSchema ] }
});
var AuthorSchema = new Schema({
	_user: { type: Schema.ObjectId, required: 'Reference to user must be provided.', ref: 'User' },
	roles: [ String ]
});
var releaseFields = {
	id:          { type: String, required: true, unique: true, 'default': shortId.generate },
	_game:       { type: Schema.ObjectId, required: 'Reference to game must be provided.', ref: 'Game' },
	name:        { type: String, required: 'Name must be provided.' },
	description: { type: String },
	versions:    { type: [ VersionSchema ], validate: [ nonEmptyArray, 'You must provide at least one version for the release.' ] },
	authors:     { type: [ AuthorSchema ], validate: [ nonEmptyArray, 'You must provide at least one author.' ] },
	_tags:     [ { type: Schema.ObjectId, ref: 'Tag' } ],
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
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, required: true, ref: 'User' }
};
var ReleaseSchema = new Schema(releaseFields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
ReleaseSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
ReleaseSchema.plugin(fileRef, { model: 'Release' });
ReleaseSchema.plugin(prettyId, { model: 'Release', ignore: [ '_created_by' ] });
ReleaseSchema.plugin(paginate);


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

ReleaseSchema.path('versions.0.files').validate(function(files, callback) {

	var i = 0;
	var that = this;
	if (!_.isArray(files) || files.length === 0) {
		return callback(true);
	}
	var hasTableFile = false;
	async.eachSeries(files, function(f, next) {
		if (f._file) {

			mongoose.model('File').findById(f._file, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.error('[model] Error fetching file "%s".', f._file);
					i++;
					return next();
				}
				if (!file) {
					// this is already validated by the file reference
					i++;
					return next();
				}

				// table checks
				if (file.getMimeCategory() === 'table') {

					hasTableFile = true;

					// flavor
					f.flavor = f.flavor || {};
					_.each(fileFields.flavor, function(obj, flavor) {
						if (!f.flavor[flavor]) {
							that.invalidate('files.' + i + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
						}
					});

					// compatibility (in here because it applies only to table files.)
					if (!_.isArray(f._compatibility) || !f._compatibility.length) {
						// TODO check if exists.
						that.invalidate('files.' + i + '._compatibility', 'At least one VP build must be provided.');
					}

					// media
					if (!f._media || !f._media.playfield_image) {
						that.invalidate('files.' + i + '._media.playfield_image', 'Playfield image must be provided.');
						i++;
						return next();
					}

					// check if exists
					mongoose.model('File').findById(f._media.playfield_image, function(err, playfieldImage) {
						/* istanbul ignore if */
						if (err) {
							logger.error('[model] Error fetching file "%s".', f._media.playfield_image);
							i++;
							return next();
						}
						if (!playfieldImage) {
							that.invalidate('files.' + i + '._media.playfield_image', 'Playfield "' + f._media.playfield_image + '" does not exist.');
							i++;
							return next();
						}
						if (!_.contains(['playfield-fs', 'playfield-ws'], playfieldImage.file_type)) {
							that.invalidate('files.' + i + '._media.playfield_image', 'Must reference a file with file_type "playfield-fs" or "playfield-ws".');
						}

						i++;
						next();
					});

				} else {
					i++;
					next();
				}


			});
		} else {
			i++;
			next();
		}
	}, function() {
		if (!hasTableFile) {
			that.invalidate('files', 'At least one table file must be provided.');
		}
		callback(true);
	});
});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.methods.toDetailed = function() {
	return this.toObject();
};

ReleaseSchema.methods.toSimple = function(opts) {
	opts = opts || {};
	opts.flavor = opts.flavor || {};
	opts.flavor.lightning = opts.flavor.lightning || 'day';
	opts.flavor.orientation = opts.flavor.orientation || 'fs';
	opts.thumb = opts.thumb || 'original';

	var i, file, thumb;
	var rls = _.pick(this.toObject(), [ 'id', 'name', 'created_at', 'authors' ]);

	rls.game = _.pick(this._game, ['id', 'title']);

	// sort versions by release date
	var versions = this.versions.sort(function(a, b) {
		var dateA = new Date(a.released_at).getTime();
		var dateB = new Date(b.released_at).getTime();
		if (dateA < dateB) { return 1; }
		if (dateA > dateB) { return -1; }
		return 0;
	});
	var latestVersion = versions[0];

	// get the file to pull media from
	for (i = 0; i < latestVersion.files.length; i++) {
		if (!latestVersion.files[i].flavor) {
			// skip non-table files
			continue;
		}
		file = latestVersion.files[i];

		if (_.isEqual(file.flavor.toObject(), opts.flavor)) {
			break;
		}
	}

	var playfieldImage = file._media.playfield_image.toObject();
	if (playfieldImage.variations[opts.thumb]) {
		thumb = _.pick(playfieldImage.variations[opts.thumb], [ 'url', 'width', 'height' ]);
	} else {
		thumb = {
			url: playfieldImage.url,
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		};
	}

	rls.latest_version = {
		version: latestVersion.version,
		thumb: {
			image: thumb,
			flavor: file.flavor
		}
	};

	return rls;
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
ReleaseSchema.set('toObject', { virtuals: true });
VersionSchema.set('toObject', { virtuals: true });
FileSchema.set('toObject', { virtuals: true });
AuthorSchema.set('toObject', { virtuals: true });

ReleaseSchema.options.toObject.transform = function(doc, release) {
	release.tags = release._tags;
	delete release.__v;
	delete release._id;
	delete release._created_by;
	delete release._tags;
	delete release._game;
};
VersionSchema.options.toObject.transform = function(doc, version) {
	delete version.id;
	delete version._id;
};
FileSchema.options.toObject.transform = function(doc, file) {
	file.media = file._media;
	file.compatibility = [];
	var VPBuild = require('mongoose').model('VPBuild');
	var File = require('mongoose').model('File');
	_.each(file._compatibility, function(compat) {
		file.compatibility.push(VPBuild.toSimple(compat));
	});
	file.file = File.toDetailed(file._file);
	delete file.id;
	delete file._id;
	delete file._file;
	delete file._media;
	delete file._compatibility;
};
AuthorSchema.options.toObject.transform = function(doc, author) {
	author.user = require('mongoose').model('User').toReduced(author._user);
	delete author.id;
	delete author._id;
	delete author._user;
};

mongoose.model('Release', ReleaseSchema);
logger.info('[model] Schema "Release" registered.');
