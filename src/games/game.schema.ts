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

import { PaginateModel, PrettyIdModel, Schema } from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import paginatePlugin = require('mongoose-paginate');

import { state } from '../state';
import { config } from '../common/settings';
import { File } from '../files/file';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';
import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { prettyIdPlugin } from '../common/mongoose/pretty.id.plugin';
import { sortableTitlePlugin } from '../common/mongoose/sortable.title.plugin';


import { isInteger, isString } from 'lodash';
import { Game } from './game';

const gameTypes = ['ss', 'em', 'pm', 'og', 'na'];
const maxAspectRatioDifference = 0.2;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const gameFields = {
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
	_backglass: { type: Schema.Types.ObjectId, ref: 'File', required: 'Backglass image must be provided.' },
	_logo: { type: Schema.Types.ObjectId, ref: 'File' },
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
	_created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' }
};
export interface GameModel extends PrettyIdModel<Game>, PaginateModel<Game> {}
export const gameSchema = new Schema(gameFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
gameSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
gameSchema.plugin(prettyIdPlugin, { model: 'Game', ignore: ['_created_by'] });
gameSchema.plugin(fileReferencePlugin);
gameSchema.plugin(paginatePlugin);
gameSchema.plugin(metricsPlugin, { hotness: { popularity: { views: 1, downloads: 10, comments: 20, stars: 30 } } });
gameSchema.plugin(sortableTitlePlugin, { src: 'title', dest: 'title_sortable' });


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------

gameSchema.path('game_type').validate(async function () {

	let ipdb = this.ipdb ? this.ipdb.number : null;

	// only check if not an original game.
	if (this.game_type !== 'og' && (!ipdb || (!isInteger(ipdb) && !(isString(ipdb) && validator.isInt(ipdb))))) {
		this.invalidate('ipdb.number', 'IPDB Number is mandatory for recreations and must be a postive integer.');
		return true;
	}

	if (this.game_type !== 'og' && this.isNew) {
		const game = await state.models.Game.findOne({ 'ipdb.number': ipdb }).exec();
		if (game) {
			this.invalidate('ipdb.number', 'The game "' + game.title + '" is already in the database and cannot be added twice.');
		}
		return true;
	}
	return true;
});

gameSchema.path('_backglass').validate(async function (backglass: File) {
	if (!backglass) {
		return true;
	}
	backglass = await state.models.File.findOne({ _id: backglass._id || backglass }).exec();
	if (backglass) {
		const ar = Math.round(backglass.metadata.size.width / backglass.metadata.size.height * 1000) / 1000;
		const arDiff = Math.abs(ar / 1.25 - 1);
		return arDiff < maxAspectRatioDifference;
	}
	return true;
}, 'Aspect ratio of backglass must be smaller than 1:1.5 and greater than 1:1.05.');


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

gameSchema.methods.isRestricted = function (what: 'release' | 'backglass'):boolean {
	return this.ipdb.mpu && config.vpdb.restrictions[what].denyMpu.includes(this.ipdb.mpu);
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
gameSchema.pre('remove', async function () {

	// fixme re-add when models available.
	// await state.models.Rating.remove({ '_ref.game':this._id }).exec();
	// await state.models.Star.remove({ '_ref.game':this._id }).exec();
	// await state.models.Medium.remove({ '_ref.game':this._id }).exec();
});
