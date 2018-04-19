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
const Rom = mongoose.model('Rom');

module.exports.up = function() {

	return new Promise((resolve, reject) => {
		Rom.collection.find({}, function(err, cursor) {
			if (err) {
				return reject(err);
			}
			resolve(cursor.toArray());
		});

	}).then(roms => {
		process.stdout.write('Got %s ROMs. Copying language to array: [ ', roms.length);
		return Promise.each(roms, rom => {
			if (rom.language) {
				return new Promise((resolve, reject) => {
					Rom.collection.updateOne({ _id: rom._id }, {
						$set: { languages: [ rom.language ] },
						$unset: { language: undefined }
					}, (err, result) => {
						if (err) {
							return reject(err);
						}
						process.stdout.write('%s ', rom.id);
						resolve(result);
					});
				});
			}
		});

	}).then(() => {
		console.log('] done!');
	});
};