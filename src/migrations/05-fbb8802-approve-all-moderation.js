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

const mongoose = require('mongoose');
const Release = mongoose.model('Release');
const Backglass = mongoose.model('Backglass');
const Rom = mongoose.model('Rom');

module.exports.up = function(grunt) {
	return Promise.each([ Release, Backglass, Rom ], model => migrate(model, grunt));
};

function migrate(model, grunt) {
	grunt.log.writeln('Migrating moderations for %s...', model.modelName);
	return model.find().exec().then(entities => {
		return Promise.each(entities, entity => {
			if (!entity.moderation.is_approved && !entity.moderation.is_refused && !entity.moderation.auto_approved && !entity.moderation.history.length) {
				entity.moderation = {
					is_approved: true,
					is_refused: false,
					auto_approved: true,
					history: []
				};
				return entity.save();
			}
		});
	});
}