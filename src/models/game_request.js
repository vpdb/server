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

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id:          { type: String, required: true, unique: true, 'default': shortId.generate },
	title:       { type: String },
	notes:       { type: String },
	ipdb_number: { type: Number, required: 'At least the IPDB number must be supplied.' },
	ipdb_title:  { type: String, required: 'Must be fetched from IPDB' },
	is_closed:   { type: Boolean, required: true, 'default': false },
	message:     { type: String }, // moderator feedback sent to user
	_game:       { type: Schema.ObjectId, ref: 'Game' },
	_created_by: { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	created_at:  { type: Date, required: true }
};
const GameRequestSchema = new Schema(fields, { usePushEach: true });

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
const apiFields = {
	simple: [ 'id', 'title', 'notes', 'ipdb_number', 'ipdb_title', 'is_closed', 'message', 'game', 'created_at' ],
	detailed: [ 'created_by' ]
};

//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
GameRequestSchema.virtual('game')
	.get(function() {
		if (this._game && this.populated('_game')) {
			return this._game.toSimple();
		}
	});

GameRequestSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
GameRequestSchema.methods.toSimple = function() {
	return _.pick(this.toObj(), apiFields.simple);
};

GameRequestSchema.methods.toDetailed = function() {
	return _.pick(this.toObj(), [ ...apiFields.simple, ...apiFields.detailed ]);
};

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
GameRequestSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('GameRequest', GameRequestSchema);
logger.info('[model] Schema "GameRequest" registered.');