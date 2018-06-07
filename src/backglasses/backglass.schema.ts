/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { isArray } from 'lodash';
import { GameReferenceModel, MetricsModel, ModeratedModel, PaginateModel, PrettyIdModel, Schema } from 'mongoose';
import paginatePlugin from 'mongoose-paginate';
import uniqueValidatorPlugin from 'mongoose-unique-validator';

import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { gameReferencePlugin } from '../common/mongoose/game.reference.plugin';
import { prettyIdPlugin } from '../common/mongoose/pretty.id.plugin';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';
import { moderationPlugin } from '../common/mongoose/moderation.plugin';
import { authorSchema } from '../users/content.author.schema';
import { User } from '../users/user';
import { backglassVersionSchema } from './backglass.version.schema';
import { Backglass } from './backglass';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

export const backglassFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	versions:      { type: [ backglassVersionSchema ], validate: { validator: nonEmptyArray, message: 'You must provide at least one version for the backglass.' } },
	description:   { type: String },
	authors:       { type: [ authorSchema ], validate: { validator: nonEmptyArray, message: 'You must provide at least one author.' } },
	acknowledgements: { type: String },
	counter:       {
		stars:     { type: Number, 'default': 0 }
	},
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.Types.ObjectId, ref: 'User', required: true }
};
export interface BackglassModel extends GameReferenceModel<Backglass>, PrettyIdModel<Backglass>, ModeratedModel<Backglass>, PaginateModel<Backglass>, MetricsModel<Backglass> {}
export const backglassSchema = new Schema(backglassFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
backglassSchema.plugin(gameReferencePlugin);
backglassSchema.plugin(uniqueValidatorPlugin, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
backglassSchema.plugin(prettyIdPlugin, { model: 'Backglass', ignore: [ '_created_by' ], validations: [
	{ path: '_file', mimeType: 'application/x-directb2s', message: 'Must be a .directb2s file.' },
	{ path: '_file', fileType: 'backglass', message: 'Must be a file of type "backglass".' }
] });
backglassSchema.plugin(fileReferencePlugin);
backglassSchema.plugin(paginatePlugin);
backglassSchema.plugin(moderationPlugin);
backglassSchema.plugin(metricsPlugin);

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

backglassSchema.methods.isCreatedBy = function(user:User):boolean {
	if (!user) {
		return false;
	}
	return this._created_by.equals(user._id);
};

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value:any[]) {
	return isArray(value) && value.length > 0;
}