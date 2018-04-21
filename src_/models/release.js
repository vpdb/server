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

'use strict';

const _ = require('lodash');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');

const uniqueValidator = require('mongoose-unique-validator');
const paginate = require('mongoose-paginate');

const metrics = require('./plugins/metrics');
const gameRef = require('./plugins/game-ref');
const fileRef = require('./plugins/file-ref');
const moderate = require('../../src/common/mongoose-plugins/moderate');
const prettyId = require('./plugins/pretty-id');
const idValidator = require('./plugins/id-ref');
const sortableTitle = require('./plugins/sortable-title');

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
const ReleaseSchema = new Schema(releaseFields, { usePushEach: true });


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
ReleaseSchema.plugin(metrics, { hotness: { popularity: { views: 1, downloads: 10, comments: 20, stars: 30 }}});
ReleaseSchema.plugin(sortableTitle, { src: 'name', dest: 'name_sortable' });

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

ReleaseSchema.path('versions').validate(function() {
	const ids = _.compact(_.map(_.flatten(_.map(this.versions, 'files')), '_file')).map(id => id.toString());
	if (_.uniq(ids).length !== ids.length) {
		this.invalidate('versions', 'You cannot reference a file multiple times.');
	}
	return true;
});

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
ReleaseSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Release', ReleaseSchema);
mongoose.model('ReleaseVersion', version.schema);
mongoose.model('ReleaseVersionFile', file.schema);
logger.info('[model] Schema "Release" registered.');
