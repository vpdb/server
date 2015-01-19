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

"use strict"; /* global _, angular*/

angular.module('vpdb.profile.downloads', [])

	.controller('ProfileDownloadsCtrl', function($scope, $rootScope, AuthService, ApiHelper, ProfileResource, ModalService) {

		var exampleTable = {
			game_title: 'Medieval Madness',
			game_manufacturer: 'Williams',
			game_year: 1998,
			release_version: '1.0.0',
			release_compatibility: 'vp10-alpha',
			original_filename: 'Medieval-Madness_Night Mod_VP9.2_V1.2_FS_FOM_SUNKEN_RELEASE.vpt'
		};

		$scope.updatedProfile = {
			table_naming: '{game_title} ({game_manufacturer}, {game_year})'
		};

		$scope.$watch('updatedProfile.table_naming', function() {
			$scope.exampleName = $scope.updatedProfile.table_naming.replace(/(\{([^\}]+)\})/g, function(m1, m2, m3) {
				return exampleTable[m3] ? exampleTable[m3] : m1;
			}) + '.vpx';
		});

	});