/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict"; /* global _, angular */

angular.module('vpdb.games.details', [])

/**
 * Formats a rating so it always displays one decimal.
 */
.filter('rating', function() {

	return function(rating) {
		rating = parseFloat(rating);
		if (!rating) {
			return ' — ';
		}
		if (rating % 1 === 0 && rating < 10) {
			return rating + '.0';
		} else {
			return Math.round(rating * 10) / 10;
		}
	};
})

.filter('dlRelease', function() {
	return function(data) {
		var game = data[0];
		var release = data[1];
		return [ game.name, release.title ];
	};
})

.filter('dlRom', function() {
	return function(data) {
		var game = data[0];
		var rom = data[1];
		return [ game.name, 'ROM <samp>' + rom.name + '</samp>' ];
	};
})

.filter('dlBackglass', function() {
	return function(data) {
		var game = data[0];
		var backglass = data[1];
		return [ game.name, 'Backglass by <strong>' + backglass.author.user + '</strong>' ];
	};
})

.filter('dlMedia', function(DisplayService) {
	return function(data) {
		var game = data[0];
		var media = data[1];
		return [
			game.name,
			DisplayService.media(media.type) + ' (' + media.format + ') by <strong>' + media.author.user + '</strong>'
		];
	};
})

.filter('dlPack', function() {
	return function(pack) {
		return [
			pack.manufacturer + ' ' + pack.number,
			pack.name
		];
	};
});