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
var shortId = require('shortid32');
var mongoose = require('mongoose');
var paginate = require('mongoose-paginate');
var validator = require('validator');
var toObj = require('./plugins/to-object');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:        { type: String, required: true, unique: true, 'default': shortId.generate },
	_from:     { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		release: { type: Schema.ObjectId, ref: 'Release', index: true, sparse: true },
		release_moderation: { type: Schema.ObjectId, ref: 'Release', index: true, sparse: true }
	},
	message:   { type: String, required: 'You must provide a message when commenting.' },
	ip:        { type: String, required: true },
	created_at: { type: Date, required: true }
};

var CommentSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
CommentSchema.plugin(paginate);
CommentSchema.plugin(toObj);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'from', 'message', 'release', 'created_at' ], // fields returned in references
	detailed: [ 'ip' ]
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
CommentSchema.path('message').validate(function(msg) {
	return _.isString(msg) && validator.isLength(msg, 3, 5000);
}, 'Message must be at least 3 chars and no longer than 5k characters.');


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
CommentSchema.virtual('from')
	.get(function() {
		if (this.populated('_from') && this._from) {
			return this._from.toReduced();
		}
		return undefined;
	});

CommentSchema.virtual('release')
	.get(function() {
		if (this.populated('_ref.release') && this._ref.release) {
			return this._ref.release.toReduced();
		}
		return undefined;
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
CommentSchema.methods.toSimple = function() {
	return CommentSchema.statics.toSimple(this);
};
CommentSchema.methods.toDetailed = function() {
	return CommentSchema.statics.toDetailed(this);
};


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
CommentSchema.statics.toSimple = function(comment) {
	var obj = comment.toObj ? comment.toObj() : comment;
	return _.pick(obj, apiFields.simple);
};
CommentSchema.statics.toDetailed = function(comment) {
	var obj = comment.toObj ? comment.toObj() : comment;
	return _.pick(obj, apiFields.detailed.concat(apiFields.simple));
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
CommentSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, comment) {
		delete comment.__v;
		delete comment._id;
		delete comment._ref;
		delete comment._from;
	}
};

mongoose.model('Comment', CommentSchema);
logger.info('[model] Schema "Comment" registered.');