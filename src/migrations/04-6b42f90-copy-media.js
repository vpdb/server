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
const mongoose = require('mongoose');
const Game = mongoose.model('Game');
const Medium = mongoose.model('Medium');
const gameCtrl = require('../controllers/api/games');

module.exports.up = function() {

	return Game.find().populate('_media.logo').populate('_media.backglass').exec().then(games => {
		return Promise.each(games, game => {
			return Medium.find({ '_ref.game': game._id }).populate('_file').exec().then(media => {
				let copies = [];
				const mediumLogo = _.find(media, m => m.file.file_type === 'logo');
				const mediumBackglass = _.find(media, m => m.file.file_type === 'backglass' && m._file.getMimeCategory() === 'image');

				if (!mediumLogo && game._media.logo) {
					console.log('Copying wheel image for game "%s"...', game.title);
					copies.push(gameCtrl._copyMedia(game._created_by, game, game._media.logo, 'wheel_image'));
				}
				if (!mediumBackglass) {
					console.log('Copying backglass for game "%s"...', game.title);
					copies.push(gameCtrl._copyMedia(game._created_by, game, game._media.backglass, 'backglass_image', bg => bg.metadata.size.width * bg.metadata.size.height > 647000));
				}
				return Promise.all(copies);
			});
		});
	});
};