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
var mongoose = require('mongoose');
var validator = require('validator');

var paginate = require('mongoose-paginate');
var uniqueValidator = require('mongoose-unique-validator');

var toObj = require('./plugins/to-object');
var fileRef = require('./plugins/file-ref');
var metrics = require('./plugins/metrics');
var prettyId = require('./plugins/pretty-id');
var sortTitle = require('./plugins/sortable-title');
var ipdb = require('../modules/ipdb');

var Schema = mongoose.Schema;

var gameTypes = [ 'ss', 'em', 'pm', 'og', 'na'];

var maxAspectRatioDifference = 0.2;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:             { type: String, required: 'Game ID must be provided.', unique: true },
	title:          { type: String, required: 'Title must be provided.', index: true },
	title_sortable: { type: String, index: true },
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
	keywords:       Array,
	features:       String,
	notes:          String,
	toys:           String,
	slogans:        String,
	ipdb: {
		number: Number,
		rating: Number,
		mfg: Number
	},
	counter:       {
		releases:  { type: Number, 'default': 0 },
		views:     { type: Number, 'default': 0 },
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
	modified_at:   { type: Date }, // only release add/update modifies this
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
GameSchema.plugin(prettyId, { model: 'Game', ignore: [ '_created_by' ] });
GameSchema.plugin(fileRef);
GameSchema.plugin(paginate);
GameSchema.plugin(toObj);
GameSchema.plugin(metrics, { hotness: { popularity: { views: 1, downloads: 10, comments: 20, stars: 30 }}});
GameSchema.plugin(sortTitle, { src: 'title', dest: 'title_sortable' });


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	reduced: [ 'id', 'title', 'manufacturer', 'year', 'ipdb' ], // fields returned in release data
	simple:  [ 'game_type', 'media', 'counter', 'rating' ]      // fields returned in lists
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
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

GameSchema.virtual('full_title')
	.get(function() {
		var fullTitle = this.title;
		if (this.year || this.manufacturer) {
			fullTitle += ' (' + this.manufacturer + ' ' + this.year + ')';
		}
		return fullTitle;
	});

GameSchema.virtual('owner')
	.get(function() {
		return ipdb.owners[this.ipdb.mfg] || this.manufacturer;
	});



//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
GameSchema.path('game_type').validate(function(gameType, callback) {

	return Promise.try(() => {
		let ipdb = this.ipdb ? this.ipdb.number : null;

		// only check if not an original game.
		if (this.game_type !== 'og' && (!ipdb || (!_.isInteger(ipdb) && !(_.isString(ipdb) && validator.isInt(ipdb))))) {
			this.invalidate('ipdb.number', 'IPDB Number is mandatory for recreations and must be a postive integer.');
			return true;
		}

		if (this.game_type !== 'og' && this.isNew) {
			return mongoose.model('Game').findOne({ 'ipdb.number': ipdb }).exec().then(game => {
				if (game) {
					this.invalidate('ipdb.number', 'The game "' + game.title + '" is already in the database and cannot be added twice.');
				}
				return true;
			});
		}
		return true;

	}).then(result => {
		callback(result);
	});
});

GameSchema.path('_media.backglass').validate(function(backglass, callback) {
	if (!backglass) {
		return callback(true);
	}
	mongoose.model('File').findOne({ _id: backglass._id || backglass }, function(err, backglass) {
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
GameSchema.methods.toReduced = function() {
	return _.pick(this.toObj(), apiFields.reduced);
};

GameSchema.methods.toSimple = function() {
	return _.pick(this.toObj(), apiFields.reduced.concat(apiFields.simple));
};

/**
 * Returns the API object for a detailed games
 * @returns {*}
 */
GameSchema.methods.toDetailed = function() {
	return this.toObj();
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
GameSchema.pre('remove', function(done) {

	const File = require('mongoose').model('File');
	return Promise.try(() => {
		// remove reference from other tables
		return Promise.all([
			['Rating', '_ref.game'],
			['Star', '_ref.game'],
			['Medium', '_ref.game']
		].map(([ model, ref ]) => mongoose.model(model).remove({ [ref]: this._id}).exec()));

	}).nodeify(done);
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
GameSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, game) {
		delete game.__v;
		delete game._id;
		delete game._media;
		delete game._created_by;
		delete game.full_title;
	}
};

mongoose.model('Game', GameSchema);
logger.info('[model] Schema "Game" registered.');
