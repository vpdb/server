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

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');

const uniqueValidator = require('mongoose-unique-validator');
const paginate = require('mongoose-paginate');

const toObj = require('./plugins/to-object');
const metrics = require('./plugins/metrics');
const gameRef = require('./plugins/game-ref');
const fileRef = require('./plugins/file-ref');
const moderate = require('./plugins/moderate');
const prettyId = require('./plugins/pretty-id');
const idValidator = require('./plugins/id-ref');
const sortableTitle = require('./plugins/sortable-title');
const releaseAggregation = require('./plugins/release-aggregation');

const flavor = require('../modules/flavor');

const file = require('./release/file');
const version = require('./release/version');
const author = require('./release/author');

const licenses = [ 'by-sa', 'by-nd' ];

const Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

// RELEASE
const releaseFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	name:          { type: String, required: 'Name must be provided.' },
	name_sortable: { type: String, index: true },
	license:       { type: String, required: 'Mod permission must be provided.', 'enum': { values: licenses, message: 'Invalid license. Valid licenses are: ["' +  licenses.join('", "') + '"].' }},
	description:   { type: String },
	versions:      { type: [ version.schema ], validate: [ nonEmptyArray, 'You must provide at least one version for the release.' ] },
	authors:       { type: [ author.schema ], validate: [ nonEmptyArray, 'You must provide at least one author.' ] }, // TODO limit to let's say 10 max
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
		stars:     { type: Number, 'default': 0 },
		views:     { type: Number, 'default': 0 }
	},
	metrics: {
		popularity: { type: Number, 'default': 0 } // time-decay based score like reddit, but based on views, downloads, comments, favs. see SO/11653545
	},
	rating: {
		average:   { type: Number, 'default': 0 },
		votes:     { type: Number, 'default': 0 },
		score:     { type: Number, 'default': 0 } // imdb-top-250-like score, a bayesian estimate.
	},
	released_at:   { type: Date, index: true },
	modified_at:   { type: Date, required: true },
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, required: true, ref: 'User' }
};
const ReleaseSchema = new Schema(releaseFields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
ReleaseSchema.plugin(gameRef);
ReleaseSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
ReleaseSchema.plugin(fileRef);
ReleaseSchema.plugin(prettyId, { model: 'Release', ignore: [ '_created_by', '_tags' ] });
ReleaseSchema.plugin(idValidator, { fields: [ '_tags' ] });
ReleaseSchema.plugin(paginate);
ReleaseSchema.plugin(moderate);
ReleaseSchema.plugin(toObj);
ReleaseSchema.plugin(metrics, { hotness: { popularity: { views: 1, downloads: 10, comments: 20, stars: 30 }}});
ReleaseSchema.plugin(sortableTitle, { src: 'name', dest: 'name_sortable' });
ReleaseSchema.plugin(releaseAggregation);

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

ReleaseSchema.path('versions').validate(function() {
	var ids = _.compact(_.map(_.flatten(_.map(this.versions, 'files')), '_file')).map(id => id.toString());
	if (_.uniq(ids).length !== ids.length) {
		this.invalidate('versions', 'You cannot reference a file multiple times.');
	}
	return true;
});

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.statics.toSimple = function(release, opts) {
	opts = opts || {};
	opts.flavor = opts.flavor || {};
	opts.fields = opts.fields || [];

	// field visibility
	var gameFields = ['id', 'title', 'manufacturer', 'year', 'license' ];
	var releaseFields = [ 'id', 'name', 'created_at', 'released_at', 'authors', 'counter', 'versions' ];
	var versionFields = [ 'version', 'released_at', 'files' ];
	var fileRefFields = [ 'released_at', 'flavor', 'compatibility', 'file' ];
	var fileFields = ['id', 'name', 'bytes', 'mime_type'];
	var compatFields = [ 'id' ];

	releaseFields.push(...opts.fields);

	var rls = _.pick(release.toObj ? release.toObj() : release, releaseFields);

	rls.game = _.pick(release._game, gameFields);

	// if results comes from an aggregation, we don't have a model and need to call toObj manually...
	if (!release.toObj) {
		rls.authors.forEach(function(authorItem) {
			author.schema.options.toObject.transform(null, authorItem);
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
	if (!rls.thumb.image) {
		// dont set thumb if images were not populated and thus not visible
		delete rls.thumb;
	}

	// set star
	if (!_.isUndefined(opts.starred)) {
		rls.starred = opts.starred;
	}

	// reduce/enhance data
	rls.versions = versions.map(v => {
		v = _.pick(v, versionFields);
		v.files = v.files.map(f => {
			let fields = [ '_file', '_compatibility' ];
			let compatibility = f.compatibility || f._compatibility;
			if (opts.thumbPerFile && opts.thumbFormat) {
				f.thumb = getFileThumb(f, opts);
				fields.push('thumb');
			}
			f = _.pick(f, [...fileRefFields, ...fields]);
			f.compatibility = _.map(compatibility, function(c) {
				return _.pick(c, compatFields);
			});
			f.file = _.pick(f.file || f._file, fileFields);
			delete f._file;
			delete f._compatibility;
			return f;
		});
		return v;
	});

	return rls;
};

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.methods.moderationChanged = function(previousModeration, moderation) {
	if (previousModeration.isApproved && !moderation.isApproved) {
		return mongoose.model('Game').update({ _id: this._game  }, { $inc: { 'counter.releases': -1 } });
	}
	if (!previousModeration.isApproved && moderation.isApproved) {
		return mongoose.model('Game').update({ _id: this._game  }, { $inc: { 'counter.releases': 1 } });
	}
};

ReleaseSchema.methods.toDetailed = function(opts) {
	var rls = this.toObj();

	opts = opts || {};
	if (opts.thumbFlavor || opts.thumbFormat) {
		rls.thumb = getReleaseThumb(rls.versions, opts);
	}

	let supressedFields = opts.supressedFields || [];
	supressedFields.forEach(field => delete rls[field]);

	// reduce/enhance data
	rls.versions = rls.versions.map(v => {
		v.files = v.files.map(f => {
			if (opts.thumbPerFile && opts.thumbFormat) {
				f.thumb = getFileThumb(f, opts);
				if (!opts.full) {
					delete f.media;
				}
			}
			return f;
		});
		return v;
	});
	if (rls.moderation) {
		rls.moderation = this.moderationToObject();
	}

	if (opts.starredReleaseIds) {
		rls.starred = _.includes(opts.starredReleaseIds, this._id.toString());
	}
	if (!_.isUndefined(opts.starred)) {
		rls.starred = opts.starred;
	}

	if (this._created_by.toReduced) {
		rls.created_by = this._created_by.toReduced();
	}
	delete rls._created_by;

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

/**
 * Returns all database IDs of all linked files as strings.
 * @returns {string[]}
 */
ReleaseSchema.methods.getFileIds = function() {
	let files = _.flatten(_.map(this.versions, 'files'));
	let tableFileIds = _.map(files, '_file').map(file => file ? (file._id ? file._id.toString() : file.toString()) : null);
	let playfieldImageId = _.compact(_.map(files, '_playfield_image')).map(file => file._id ? file._id.toString() : file.toString());
	let playfieldVideoId = _.compact(_.map(files, '_playfield_video')).map(file => file._id ? file._id.toString() : file.toString());
	return _.compact(_.flatten([...tableFileIds, playfieldImageId, playfieldVideoId]));
};

ReleaseSchema.methods.getPlayfieldImageIds = function() {
	let files = _.flatten(_.map(this.versions, 'files'));
	return _.compact(_.map(files, '_playfield_image')).map(file => file._id ? file._id.toString() : file.toString());
};

ReleaseSchema.methods.isCreatedBy = function(user) {
	if (!user) {
		return false;
	}
	let userId = user._id || user;
	return this._created_by.equals(userId);
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
ReleaseSchema.pre('remove', function(next) {

	return Promise.try(() => {
		// remove linked comments
		return mongoose.model('Comment').remove({ $or: [ { '_ref.release': this._id }, { '_ref.release_moderation': this._id } ]}).exec();

	}).then(() => {
		// remove table blocks
		const TableBlock = mongoose.model('TableBlock');
		let fileIds = [];
		this.versions.forEach(version => {
			version.files.forEach(file => {
				fileIds.push(file._file._id || file._file);
			});
		});
		logger.info('[model] Removing all table blocks for file IDs [ %s ]', fileIds.map(fid => fid.toString()).join(', '));
		return Promise.each(fileIds, fileId => {
			return TableBlock.update(
				{ _files: fileId },
				{ $pull: { _files: fileId } },
				{ multi: true }
			);
		}).then(() => {
			return TableBlock.remove({ _files: { $size: 0 } }).exec();
		});
	}).nodeify(next);
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

mongoose.model('Release', ReleaseSchema);
mongoose.model('ReleaseVersion', version.schema);
mongoose.model('ReleaseVersionFile', file.schema);
logger.info('[model] Schema "Release" registered.');


/**
 * Returns the thumb object for the given options provided by the user.
 *
 * Basically it looks at thumbFlavor and thumbFormat and tries to return
 * the best match.
 * @param versions
 * @param {{ thumbFlavor:string, thumbFormat:string, fullThumbData:boolean }} opts thumbFlavor: "orientation:fs,lighting:day", thumbFormat: variation name or "original"
 * @returns {{image: *, flavor: *}}
 */
function getReleaseThumb(versions, opts) {

	opts.thumbFormat = opts.thumbFormat || 'original';

	/** @type {{ lighting:string, orientation:string }} */
	const flavorDefaults = flavor.defaultThumb();
	/** @type {{ lighting:string, orientation:string }} */
	const flavorParams = (opts.thumbFlavor || '').split(',').map(f => f.split(':')).reduce((a, v) => _.assign(a, { [v[0]]: v[1]}), {});

	// get all table files
	const files = _.flatten(_.map(versions, 'files')).filter(file => file.flavor);

//	console.log('flavorParams: %j, flavorDefaults: %j', flavorParams, flavorDefaults);

	// assign weights to each file depending on parameters
	/** @type {{ file: {[playfield_image]:{}, [_playfield_image]:{}}, weight:number }[]} */
	const filesByWeight = _.orderBy(files.map(file => {

		/** @type {{ lighting:string, orientation:string }} */
		const fileFlavor = file.flavor.toObj ? file.flavor.toObj() : file.flavor;
		let weight = 0;
		const flavorNames = getFlavorNames(opts);
		let p = flavorNames.length + 1;
		flavorNames.forEach(flavorName => {

			// parameter match gets most weight.
			if (fileFlavor[flavorName] === flavorParams[flavorName]) {
				weight += Math.pow(10, p * 3);

			// defaults match gets also weight, but less
			} else if (fileFlavor[flavorName] === flavorDefaults[flavorName]) {
				weight += Math.pow(10, p);
			}
			p--;
		});

//		console.log('%s / %j => %d', opts.thumbFlavor, fileFlavor, weight);
		return {
			file: file,
			weight: weight
		};

	}), ['weight'], ['desc']);

	const bestMatch = filesByWeight[0].file;
	const thumb = getFileThumb(bestMatch, opts);
	// can be null if invalid thumbFormat was specified
	if (thumb === null) {
		return {
			image: getDefaultThumb(bestMatch, opts),
			flavor: bestMatch.flavor
		};
	}
	return {
		image: thumb,
		flavor: bestMatch.flavor
	};
}

/**
 * Returns playfield thumb for a given release file.
 * Can return null if playfield is not populated or thumbFormat is invalid or not specified.
 *
 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table
 * @param {{ fullThumbData:boolean, thumbFormat:string }} opts thumbFormat is the variation or "original" if the full link is desired.
 * @returns {{}|null}
 */
function getFileThumb(file, opts) {

	let thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
	if (opts.fullThumbData) {
		thumbFields = [...thumbFields, 'mime_type', 'bytes', 'file_type'];
	}

	if (!opts.thumbFormat) {
		return null;
	}

	const playfieldImage = getPlayfieldImage(file);

	// if not populated, return null
	if (!playfieldImage || !playfieldImage.metadata) {
		return null;
	}

	if (opts.thumbFormat === 'original') {
		return _.assign(_.pick(playfieldImage, thumbFields), {
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		});

	} else if (playfieldImage.variations[opts.thumbFormat]) {
		return _.pick(playfieldImage.variations[opts.thumbFormat], thumbFields);
	}
	return null;
}

/**
 * Returns the default thumb of a file.
 *
 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table file
 * @param {{ fullThumbData: boolean }} opts
 * @returns {{}|null}
 */
function getDefaultThumb(file, opts) {

	var playfieldImage = getPlayfieldImage(file);
	if (!playfieldImage || !playfieldImage.metadata) {
		return null;
	}
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

/**
 * Returns all known flavor names sorted by given parameters.
 * @param opts
 * @returns {Array}
 */
function getFlavorNames(opts) {
	return _.uniq([ ...(opts.thumbFlavor || '').split(',').map(f => f.split(':')[0]), 'orientation', 'lighting' ]);
}

/**
 * Returns the playfield image property from the table file object.
 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table file
 * @returns {{}|ObjectId|null}
 */
function getPlayfieldImage(file) {
	var playfieldImage = file.playfield_image || file._playfield_image;
	if (!playfieldImage) {
		return null;
	}
	return playfieldImage.toObj ? playfieldImage.toObj() : playfieldImage;
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