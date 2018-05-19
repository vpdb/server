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

import { keys } from 'lodash';
import { PrettyIdOptions, Schema } from 'mongoose';

import { flavors } from './release.flavors';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';
import { prettyIdPlugin } from '../common/mongoose/pretty.id.plugin';

const validationStatusValues = ['verified', 'playable', 'broken'];

export const releaseVersionFileFields = {
	_file:  { type: Schema.Types.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	flavor: {
		orientation: { type: String, 'enum': { values: flavors.flavorValues('orientation'), message: 'Invalid orientation. Valid orientation are: ["' + keys(flavors.flavorValues('orientation')).join('", "') + '"].' }},
		lighting:    { type: String, 'enum': { values: flavors.flavorValues('lighting'), message: 'Invalid lighting. Valid options are: ["' + keys(flavors.flavorValues('lighting')).join('", "') + '"].' }}
	},
	validation: {
		status:  { type: String, 'enum': { values: validationStatusValues, message: 'Invalid status, must be one of: ["' + validationStatusValues.join('", "') + '"].' }},
		message: { type: String },
		validated_at:    { type: Date },
		_validated_by:   { type: Schema.Types.ObjectId, ref: 'User' }
	},
	_compatibility: [ { type: Schema.Types.ObjectId, ref: 'Build' } ],
	_playfield_image: { type: Schema.Types.ObjectId, ref: 'File' },
	_playfield_video: { type: Schema.Types.ObjectId, ref: 'File' },
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, 'default': 0 }
	}
};

export const releaseVersionFileSchema = new Schema(releaseVersionFileFields,{ toObject: { virtuals: true, versionKey: false } });

releaseVersionFileSchema.plugin(fileReferencePlugin);
releaseVersionFileSchema.plugin(prettyIdPlugin, { model: 'ReleaseVersionFile' } as PrettyIdOptions);
