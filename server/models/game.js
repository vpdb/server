/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var async = require('async');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var fileRef = require('../models/plugins/fileRef');

var Schema = mongoose.Schema;

var gameTypes = [ 'ss', 'em', 'pm', 'og', 'na'];

var maxAspectRatioDifference = 0.2;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:             { type: String, required: 'Game ID must be provided.', unique: true },
	title:          { type: String, required: 'Title must be provided.', index: true },
	year:           { type: Number, required: 'Year must be provided.', index: true },
	manufacturer:   { type: String, required: 'Manufacturer must be provided.', index: true },
	game_type:      { type: String, required: true, enum: { values: gameTypes, message: 'Invalid game type. Valid game types are: ["' +  gameTypes.join('", "') + '"].' }},
	short:          Array,
	description:    String,
	instructions:   String,
	produced_units: Number,
	model_number:   String,
	themes:         Array,
	designers:      Array,
	artists:        Array,
	features:       String,
	notes:          String,
	toys:           String,
	slogans:        String,
	ipdb: {
		number: Number,
		rating: Number,
		mfg: Number
	},
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, required: true, ref: 'User' },
	_media: {
		backglass: { type: Schema.ObjectId, ref: 'File', required: 'Backglass image must be provided.' },
		logo:      { type: Schema.ObjectId, ref: 'File' }
	}
};
var GameSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
GameSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
GameSchema.plugin(fileRef, { model: 'Game', fields: [ '_media.backglass', '_media.logo' ]});


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'title', 'manufacturer', 'year', 'game_type', 'ipdb', 'media' ] // fields returned in lists
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
GameSchema.virtual('url')
	.get(function() {
		return '/game/' + this.id;
	});

GameSchema.virtual('media')
	.get(function() {
		var media = {};
		if (this.populated('_media.backglass') && this._media.backglass) {
			media.backglass = this._media.backglass.toSimple();
		}
		if (this.populated('_media.logo') && this._media.logo) {
			media.logo = this._media.logo.toSimple();
		}
		return media;
	});


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
GameSchema.path('game_type').validate(function(gameType, callback) {

	var ipdb = this.ipdb ? this.ipdb.number : null;

	// only check if not an original game.
	if (this.game_type !== 'og' && (!ipdb || !validator.isInt(ipdb))) {
		this.invalidate('ipdb.number', 'IPDB Number is mandatory for recreations and must be a postive integer.');
		return callback(true);
	}

	var that = this;
	if (this.game_type !== 'og') {
		mongoose.model('Game').findOne({ 'ipdb.number': ipdb }, function(err, g) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[model|game] Error fetching game %s.');
				return callback(false);
			}
			if (g) {
				that.invalidate('ipdb.number', 'The game "' + g.title + '" is already in the database and cannot be added twice.');
			}
			callback();
		});
	}
});

GameSchema.path('_media.backglass').validate(function(backglass, callback) {
	if (!backglass) {
		return;
	}
	mongoose.model('File').findOne({ _id: backglass }, function(err, backglass) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[model|game] Error fetching backglass %s.');
			return callback(false);
		}
		if (backglass) {
			var ar = Math.round(backglass.metadata.size.width / backglass.metadata.size.height * 1000) / 1000;
			var arDiff = Math.abs(ar / 1.25 - 1);
			return callback(arDiff < maxAspectRatioDifference);
		}
		callback(true);
	});
}, 'Aspect ratio of backglass must be smaller than 1:1.5 and greater than 1:1.05.');


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
GameSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};

GameSchema.methods.toDetailed = function() {
	return this.toObject();
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
GameSchema.pre('remove', function(next) {
	var File = require('mongoose').model('File');
	var removeFile = function(ref) {
		return function(next) {
			var remove = function(err, file) {
				/* istanbul ignore if  */
				if (err) {
					return next(err);
				}
				file.remove(next);
			};
			if (!ref) {
				return next();
			}
			if (!ref.id) {
				File.findById(ref._id, remove);
			} else {
				remove(null, ref);
			}
		};
	};
	async.parallel([ removeFile(this._media.backglass), removeFile(this._media.logo) ], next);
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
GameSchema.set('toObject', { virtuals: true });
if (!GameSchema.options.toObject) {
	GameSchema.options.toObject = {};
}
GameSchema.options.toObject.transform = function(doc, game) {
	delete game.__v;
	delete game._id;
	delete game._media;
};

mongoose.model('Game', GameSchema);
logger.info('[model] Model "game" registered.');
