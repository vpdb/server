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
var logger = require('winston');
var async = require('async');
var mongoose = require('mongoose');
var validator = require('validator');

var paginate = require('mongoose-paginate');
var uniqueValidator = require('mongoose-unique-validator');

var toObj = require('./plugins/to-object');
var fileRef = require('./plugins/file-ref');
var metrics = require('./plugins/metrics');
var prettyId = require('./plugins/pretty-id');
var sortTitle = require('./plugins/sortable-title');

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
GameSchema.plugin(metrics, { hotness: { popularity: { views: 1, downloads: 10, comments: 20 }}});
GameSchema.plugin(sortTitle, { src: 'title', dest: 'title_sortable' });


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'title', 'manufacturer', 'year', 'game_type', 'ipdb', 'media', 'counter', 'rating' ] // fields returned in lists
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

GameSchema.virtual('full_title')
	.get(function() {
		var fullTitle = this.title;
		if (this.year || this.manufacturer) {
			fullTitle += ' (' + this.manufacturer + ' ' + this.year + ')';
		}
		return fullTitle;
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
		return callback(true);
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
	return _.pick(this.obj(), apiFields.simple);
};

GameSchema.methods.toDetailed = function(callback) {
	if (!callback) {
		return this.obj();
	} else {
		var game = this.obj();
		var Release = require('mongoose').model('Release');

		Release.find({ _game: this._id })
			.populate({ path: '_tags' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._media.playfield_image' })
			.populate({ path: 'versions.files._media.playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec(function (err, releases) {
				if (err) {
					return callback(err);
				}
				game.releases = _.map(releases, function(release) {
					return release.toDetailed();
				});
				callback(null, game);
			});
	}
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
	var that = this;
	var cleanup = [];
	cleanup.push(removeFile(this._media.backglass));
	cleanup.push(removeFile(this._media.logo));
	cleanup.push(function(next) {
		// remove linked comments
		mongoose.model('Rating').remove({ '_ref.game': that._id}).exec(next);
	});

	async.parallel(cleanup, next);
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
		delete game.full_title;
	}
};

mongoose.model('Game', GameSchema);
logger.info('[model] Schema "Game" registered.');
