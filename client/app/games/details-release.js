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

"use strict"; /* global _, angular */

angular.module('vpdb.games.details', []).controller('ReleaseController', function(
	$scope, $rootScope, $uibModal,  $timeout, ApiHelper, ReleaseCommentResource, AuthService,
	ReleaseRatingResource
) {

	// setup releases
	$scope.$watch('release', function(release) {

		// sort versions
		$scope.releaseVersions = _.sortByOrder(release.versions, 'released_at', false);
		$scope.latestVersion = $scope.releaseVersions[0];

		// get latest shots
		$scope.shot = _.sortByOrder(_.compact(_.map($scope.latestVersion.files, function(file) {
			if (!file.media || !file.media.playfield_image) {
				return null;
			}
			return {
				type: file.media.playfield_image.file_type,
				url: file.media.playfield_image.variations['medium' + $rootScope.pixelDensitySuffix].url,
				full: file.media.playfield_image.variations.full.url
			};
		})), 'type', true)[0];


	});

	/**
	 * Returns the version for a given file.
	 * @param file
	 * @returns {*}
	 */
	$scope.getVersion = function(file) {
		return _.filter($scope.release.versions, function(version) {
			return _.filter(version.files, function(f) {
					return file.file.id === f.file.id;
			}).length > 0;
		})[0];
	};

});