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

"use strict"; /* global angular, _ */

angular.module('vpdb.release', [])

	.factory('ReleaseService', function(Flavors) {

		return {

			flavorGrid: function(release) {

				var that = this;
				var flavors = _.sortByOrder(_.flatten(_.pluck(release.versions, 'files')), 'released_at', true);
				var flavorGrid = {};
				_.each(_.filter(flavors, function(file) {
					return file.flavor ? true : false
				}), function(file) {
					var compat = _.pluck(file.compatibility, 'id');
					compat.sort();
					var flavor = '';
					_.each(_.keys(file.flavor).sort(), function(key) {
						flavor += key + ':' + file.flavor[key] + ',';
					});
					var key = compat.join('/') + '-' + flavor;
					var short = file.flavor.orientation == 'any' && file.flavor.lighting == 'any'
						? 'Universal'
						:  Flavors.orientation.values[file.flavor.orientation].short + ' / ' + Flavors.lighting.values[file.flavor.lighting].name;
					flavorGrid[key] = {
						file: file,
						orientation: Flavors.orientation.values[file.flavor.orientation],
						lighting: Flavors.lighting.values[file.flavor.lighting],
						version: that.getVersion(release, file),
						short: short
					};
				});
				return _.sortByOrder(_.values(flavorGrid), 'released_at', false);
			},

			getVersion: function(release, file) {
				return _.filter(release.versions, function(version) {
					return _.filter(version.files, function(f) {
							return file.file.id === f.file.id;
						}).length > 0;
				})[0];
			}
		}
	});

