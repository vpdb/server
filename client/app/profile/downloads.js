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

	.controller('ProfileDownloadsCtrl', function($scope, $rootScope, AuthService, ApiHelper, ProfileResource) {

		var init = function() {
			$scope.updatedPreferences = AuthService.getUser().preferences || {};
			$scope.updatedPreferences.tablefile_name = $scope.updatedPreferences.tablefile_name || '{game_title} ({game_manufacturer} {game_year})';
			$scope.updatedPreferences.flavor_tags = $scope.updatedPreferences.flavor_tags || {
				orientation: { fs: 'FS', ws: 'DT' },
				lightning: { day: '', night: 'Nightmod' }
			};
		};
		init();

		var releaseData = {
			game_title: 'Twilight Zone',
			game_manufacturer: 'Williams',
			game_year: 1993,
			release_name: 'Powerflip Edition',
			release_version: '1.2.0',
			release_compatibility: 'VP10-alpha',
			original_filename: 'Twilight-Zone_Night Mod_VP9.2_V1.2_FS_APC FOM-UUP2_WMS'
		};

		var updateExample = function() {
			$scope.exampleName = $scope.updatedPreferences.tablefile_name.replace(/(\{([^\}]+)\})/g, function(m1, m2, m3) {
				return releaseData[m3] ? releaseData[m3] : m1;
			}) + '.vpx';
			$scope.exampleName = $scope.exampleName.replace('{release_flavor_orientation}', $scope.updatedPreferences.flavor_tags.orientation.fs);
			$scope.exampleName = $scope.exampleName.replace('{release_flavor_lightning}', $scope.updatedPreferences.flavor_tags.lightning.day);
		};

		$scope.$watch('updatedPreferences.tablefile_name', updateExample);
		$scope.$watch('updatedPreferences.flavor_tags.orientation.fs', updateExample, true);
		$scope.$watch('updatedPreferences.flavor_tags.lightning.day', updateExample, true);

		$scope.updateUserPreferences = function() {
			ProfileResource.patch({ preferences: $scope.updatedPreferences }, function(user) {

				$rootScope.showNotification('User Preferences successfully saved');
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);
				init();

			}, ApiHelper.handleErrors($scope));
		};

	});