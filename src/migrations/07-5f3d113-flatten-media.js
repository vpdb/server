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
const Game = mongoose.model('Game');
const Release = mongoose.model('Release');

module.exports.up = function(grunt) {

	return migrateGames(grunt).then(() => migrateReleases(grunt));
};

function migrateGames(grunt) {
	return new Promise((resolve, reject) => {
		Game.collection.find({}, function(err, cursor) {
			if (err) {
				return reject(err);
			}
			resolve(cursor.toArray());
		});

	}).then(games => {
		grunt.log.write('Got %s games for flattening: [ ', games.length);
		return Promise.each(games, game => {
			if (game._media) {
				return new Promise((resolve, reject) => {
					let set = {
						_backglass: game._media.backglass
					};
					if (game._media.logo) {
						set._logo = game._media.logo;
					}
					Game.collection.updateOne({ _id: game._id }, {
						$set: set,
						$unset: { _media: undefined }
					}, (err, result) => {
						if (err) {
							return reject(err);
						}
						grunt.log.write('%s ', game.id);
						resolve(result);
					});
				});
			}
		});

	}).then(() => {
		grunt.log.writeln('] done!');
	});
}

function migrateReleases(grunt) {
	return new Promise((resolve, reject) => {
		Release.collection.find({}, function(err, cursor) {
			if (err) {
				return reject(err);
			}
			resolve(cursor.toArray());
		});

	}).then(releases => {
		grunt.log.write('Got %s releases for flattening: [ ', releases.length);
		return Promise.each(releases, release => {
			let set = {};
			let unset = {};
			let versionIndex = 0;
			release.versions.forEach(version => {
				let fileIndex = 0;
				version.files.forEach(file => {
					if (file._media) {
						set['versions.' + versionIndex + '.files.' + fileIndex + '._playfield_image'] = file._media.playfield_image;
						if (file._media.playfield_video) {
							set['versions.' + versionIndex + '.files.' + fileIndex + '._playfield_video'] = file._media.playfield_video;
						}
						unset['versions.' + versionIndex + '.files.' + fileIndex + '._media'] = undefined;
					}
					fileIndex++;
				});
				versionIndex++;
			});
			return new Promise((resolve, reject) => {

				Release.collection.updateOne({ _id: release._id }, { $set: set, $unset: unset }, (err, result) => {
					if (err) {
						return reject(err);
					}
					grunt.log.write('%s ', release.id);
					resolve(result);
				});
			});
		});

	}).then(() => {
		grunt.log.writeln('] done!');
	});
}