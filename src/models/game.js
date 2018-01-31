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
const mongoose = require('mongoose');
const validator = require('validator');

const paginate = require('mongoose-paginate');
const uniqueValidator = require('mongoose-unique-validator');

const toObj = require('./plugins/to-object');
const fileRef = require('./plugins/file-ref');
const metrics = require('./plugins/metrics');
const prettyId = require('./plugins/pretty-id');
const sortTitle = require('./plugins/sortable-title');
let ipdb = require('../modules/ipdb');
const config = require('../modules/settings').current;

const Schema = mongoose.Schema;

const gameTypes = ['ss', 'em', 'pm', 'og', 'na'];

const maxAspectRatioDifference = 0.2;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: { type: String, required: 'Game ID must be provided.', unique: true },
	title: { type: String, required: 'Title must be provided.', index: true },
	title_sortable: { type: String, index: true },
	year: { type: Number, required: 'Year must be provided.', index: true },
	manufacturer: { type: String, required: 'Manufacturer must be provided.', index: true },
	game_type: {
		type: String,
		required: true,
		enum: {
			values: gameTypes,
			message: 'Invalid game type. Valid game types are: ["' + gameTypes.join('", "') + '"].'
		}
	},
	_backglass: { type: Schema.ObjectId, ref: 'File', required: 'Backglass image must be provided.' },
	_logo: { type: Schema.ObjectId, ref: 'File' },
	short: Array,
	description: String,
	instructions: String,
	produced_units: Number,
	model_number: String,
	themes: Array,
	designers: Array,
	artists: Array,
	keywords: Array,
	features: String,
	notes: String,
	toys: String,
	slogans: String,
	ipdb: {
		number: Number,
		rating: Number,
		rank: Number,
		mfg: Number,
		mpu: Number
	},
	pinside: {
		ids: [String],
		ranks: [Number],
		rating: Number
	},
	counter: {
		releases: { type: Number, 'default': 0 },
		views: { type: Number, 'default': 0 },
		downloads: { type: Number, 'default': 0 },
		comments: { type: Number, 'default': 0 },
		stars: { type: Number, 'default': 0 }
	},
	metrics: {
		popularity: { type: Number, 'default': 0 } // time-decay based score like reddit, but based on views, downloads, comments, favs. see SO/11653545
	},
	rating: {
		average: { type: Number, 'default': 0 },
		votes: { type: Number, 'default': 0 },
		score: { type: Number, 'default': 0 } // imdb-top-250-like score, a bayesian estimate.
	},
	modified_at: { type: Date }, // only release add/update modifies this
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.ObjectId, required: true, ref: 'User' }
};
const GameSchema = new Schema(fields, { usePushEach: true });


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
const apiFields = {
	reduced: ['id', 'title', 'manufacturer', 'year', 'ipdb'], // fields returned in release data
	simple: ['game_type', 'backglass', 'logo', 'counter', 'rating', 'mpu', 'restrictions']      // fields returned in lists
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
GameSchema.virtual('backglass')
	.get(function() {
		if (this.populated('_backglass') && this._backglass) {
			return this._backglass.toSimple();
		}
	});
GameSchema.virtual('logo')
	.get(function() {
		if (this.populated('_logo') && this._logo) {
			return this._logo.toSimple();
		}
	});

GameSchema.virtual('full_title')
	.get(function() {
		let fullTitle = this.title;
		if (this.year || this.manufacturer) {
			fullTitle += ' (' + this.manufacturer + ' ' + this.year + ')';
		}
		return fullTitle;
	});

GameSchema.virtual('owner')
	.get(function() {
		return ipdb.owners[this.ipdb.mfg] || this.manufacturer;
	});

GameSchema.virtual('restrictions')
	.get(function() {
		let restrictions = {};
		if (config.vpdb.restrictions.release.denyMpu.includes(this.ipdb.mpu)) {
			restrictions.release = { mpu: true };
		}
		if (config.vpdb.restrictions.backglass.denyMpu.includes(this.ipdb.mpu)) {
			restrictions.backglass = { mpu: true };
		}
		if (config.vpdb.restrictions.rom.denyMpu.includes(this.ipdb.mpu)) {
			restrictions.rom = { mpu: true };
		}
		if (!_.isEmpty(restrictions)) {
			return restrictions;
		}
	});

GameSchema.virtual('mpu')
	.get(function() {
		if (this.ipdb.mpu && ipdb.systems[this.ipdb.mpu]) {
			return ipdb.systems[this.ipdb.mpu];
		}
	});



//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
GameSchema.path('game_type').validate(function() {

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

	});
});

GameSchema.path('_backglass').validate(function(backglass) {
	return Promise.try(() => {
		if (!backglass) {
			return true;
		}
		return mongoose.model('File').findOne({ _id: backglass._id || backglass }).exec();
	}).then(backglass => {
		if (backglass) {
			const ar = Math.round(backglass.metadata.size.width / backglass.metadata.size.height * 1000) / 1000;
			const arDiff = Math.abs(ar / 1.25 - 1);
			return arDiff < maxAspectRatioDifference;
		}
		return true;
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

GameSchema.methods.isRestricted = function(what) {
	return this.ipdb.mpu && config.vpdb.restrictions[what].denyMpu.includes(this.ipdb.mpu);
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
GameSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Game', GameSchema);
logger.info('[model] Schema "Game" registered.');
