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

import { PaginateModel, Schema } from 'mongoose';
import paginatePlugin = require('mongoose-paginate');
import { LogEvent } from './log.event';

// also update slackbot when adding new events
const events = [
	'create_comment',
	'star_game', 'star_release', 'star_user',
	'unstar_game', 'unstar_release', 'unstar_user',
	'rate_game', 'unrate_game', 'rate_release', 'unrate_release',
	'upload_rom',
	'create_build', 'update_build', 'delete_build',
	'create_game', 'update_game', 'delete_game',
	'create_release', 'update_release', 'create_release_version', 'update_release_version', 'delete_release', 'validate_release',
	'create_backglass', 'delete_backglass', 'update_backglass',
	'moderate',
	'create_game_request', 'update_game_request', 'delete_game_request',
];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const logEventFields = {
	_actor: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		game: { type: Schema.Types.ObjectId, ref: 'Game', index: true, sparse: true },
		release: { type: Schema.Types.ObjectId, ref: 'Release', index: true, sparse: true },
		backglass: { type: Schema.Types.ObjectId, ref: 'Backglass', index: true, sparse: true },
		user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
		game_request: { type: Schema.Types.ObjectId, ref: 'GameRequest', index: true, sparse: true },
		build: { type: Schema.Types.ObjectId, ref: 'Build', index: true, sparse: true },
	},
	event: { type: String, enum: events, required: true, index: true },
	payload: {},
	is_public: { type: Boolean, required: true, default: false },
	ip: { type: String, required: true },
	logged_at: { type: Date, required: true },
};
export interface LogEventModel extends PaginateModel<LogEvent> { }
export const logEventSchema = new Schema(logEventFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
logEventSchema.plugin(paginatePlugin);
