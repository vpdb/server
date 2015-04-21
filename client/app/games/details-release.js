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

angular.module('vpdb.games.details', []).controller('ReleaseController', function(
	$scope, $rootScope, ApiHelper, ReleaseCommentResource, AuthService, ReleaseRatingResource
) {

	// setup releases
	$scope.$watch('release', function(release) {

		console.log(release);

		// sort versions
		$scope.releaseVersions = _.sortByOrder(release.versions, 'released_at', false);
		$scope.latestVersion = $scope.releaseVersions[0];

		// get latest shots
		$scope.portraitShots = _.compact(_.map($scope.latestVersion.files, function(file) {
			if (!file.media || !file.media.playfield_image || file.media.playfield_image.file_type !== 'playfield-fs') {
				return null;
			}
			return { url: file.media.playfield_image.variations.medium.url };
		}));

		// fetch comments
		$scope.comments = ReleaseCommentResource.query({ releaseId: release.id });

		// make flavor grid
		var flavors = _.sortByOrder(_.flatten(_.pluck(release.versions, 'files')), 'released_at', true);
		var flavorGrid = {};
		_.each(flavors, function(file) {
			var compat = _.pluck(file.compatibility, 'id');
			compat.sort();
			var flavor = '';
			_.each(_.keys(file.flavor).sort(), function(key) {
				flavor += key + ':' + file.flavor[key] + ',';
			});
			var key = compat.join('/') + '-' + flavor;
			flavorGrid[key] = file;
		});
		$scope.flavorGrid = _.sortByOrder(_.values(flavorGrid), 'released_at', false);

		// setup pop (TODO, not working)
		setTimeout(function() {
			$('.image-link').magnificPopup({
				type: 'image',
				removalDelay: 300,
				mainClass: 'mfp-fade'
			});
		}, 0);
	});


	// setup comments
	$scope.newComment = '';
	$scope.addComment = function(releaseId) {
		ReleaseCommentResource.save({ releaseId: releaseId }, { message: $scope.newComment }, function(comment) {
			$scope.comments.unshift(comment);
			$scope.newComment = '';
		}, ApiHelper.handleErrors($scope));
	};

	// ratings
	if (AuthService.isAuthenticated) {
		ReleaseRatingResource.get({ releaseId: $scope.release.id }).$promise.then(function(rating) {
			$scope.releaseRating = rating;
		});
	}

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


	/**
	 * Rates a release
	 * @param rating Rating
	 */
	$scope.rateRelease = function(rating) {
		var done = function(result) {
			$scope.release.rating = result.release;
			$scope.releaseRating = result.release;
		};
		if ($scope.releaseRating) {
			ReleaseRatingResource.update({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully updated rating.');

		} else {
			ReleaseRatingResource.save({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully rated release!');
		}
	};

});