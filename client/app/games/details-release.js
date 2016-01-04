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
	$scope, $rootScope, $uibModal, ApiHelper, ReleaseCommentResource, AuthService,
	ReleaseRatingResource, ReleaseStarResource, ModalService
) {

	// setup releases
	$scope.$watch('release', function(release) {

		// sort versions
		$scope.releaseVersions = _.sortByOrder(release.versions, 'released_at', false);
		$scope.latestVersion = $scope.releaseVersions[0];

		// get latest shots
		$scope.portraitShots = _.compact(_.map($scope.latestVersion.files, function(file) {
			if (!file.media || !file.media.playfield_image || file.media.playfield_image.file_type !== 'playfield-fs') {
				return null;
			}
			return { url: file.media.playfield_image.variations['medium' + $rootScope.pixelDensitySuffix].url };
		}));

		// fetch comments
		$scope.comments = ReleaseCommentResource.query({ releaseId: release.id });

		var flavors = _.sortByOrder(_.flatten(_.pluck(release.versions, 'files')), 'released_at', true);
		var flavorGrid = {};
		_.each(_.filter(flavors, function(file) { return file.flavor ? true : false }), function(file) {
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
	if (AuthService.hasPermission('releases/rate')) {
		ReleaseRatingResource.get({ releaseId: $scope.release.id }).$promise.then(function(rating) {
			$scope.releaseRating = rating.value;
		});
	}

	// stars
	if (AuthService.hasPermission('releases/star')) {
		ReleaseStarResource.get({ releaseId: $scope.release.id }).$promise.then(function() {
			$scope.releaseStarred = true;
		}, function() {
			$scope.releaseStarred = false;
		});
	}

	/**
	 * Opens the game download dialog
	 *
	 * @param game Game
	 */
	$scope.download = function(game) {

		if (AuthService.isAuthenticated) {
			$uibModal.open({
				templateUrl: '/games/modal-download.html',
				controller: 'DownloadGameCtrl',
				size: 'lg',
				resolve: {
					params: function() {
						return {
							game: game,
							release: $scope.release,
							latestVersion: $scope.latestVersion
						};
					}
				}
			});

		} else {
			$rootScope.login({
				headMessage: 'In order to download this release, you need to be logged. You can register for free just below.'
			});
		}
	};

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
		};
		if ($scope.releaseRating) {
			ReleaseRatingResource.update({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully updated rating.');

		} else {
			ReleaseRatingResource.save({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully rated release!');
		}
	};

	/**
	 * Stars or unstars a game depending if game is already starred.
	 */
	$scope.toggleStar = function() {
		var err = function(err) {
			if (err.data && err.data.error) {
				ModalService.error({
					subtitle: 'Error starring release.',
					message: err.data.error
				});
			} else {
				console.error(err);
			}
		};
		if ($scope.releaseStarred) {
			ReleaseStarResource.delete({ releaseId: $scope.release.id }, {}, function() {
				$scope.releaseStarred = false;
				$scope.release.counter.stars--;
			}, err);
		} else {
			ReleaseStarResource.save({ releaseId: $scope.release.id }, {}, function(result) {
				$scope.releaseStarred = true;
				$scope.release.counter.stars = result.total_stars;
			}, err);
		}
	};

}).controller('DownloadGameCtrl', function($scope, $modalInstance, $timeout, Flavors, DownloadService, params) {

	$scope.game = params.game;
	$scope.release = params.release;
	$scope.latestVersion = params.latestVersion;
	$scope.flavors = Flavors;

	$scope.downloadFiles = {};
	$scope.downloadRequest = {
		files: [],
		media: {
			playfield_image: true,
			playfield_video: false
		},
		game_media: true,
		roms: false
	};

	$scope.download = function() {
		DownloadService.downloadRelease($scope.release.id, $scope.downloadRequest, function() {
			$modalInstance.close(true);
		});
	};

	$scope.toggleFile = function(file) {
		if ($scope.downloadFiles[file.file.id]) {
			delete $scope.downloadFiles[file.file.id];
		} else {
			$scope.downloadFiles[file.file.id] = file;
		}
		$scope.downloadRequest.files = _.values(_.pluck(_.pluck($scope.downloadFiles, 'file'), 'id'));
	};

	// todo refactor (make it more useful)
	$scope.tableFile = function(file) {
		return file.file.mime_type && /^application\/x-visual-pinball-table/i.test(file.file.mime_type);
	};
});


/**
 * Takes a sorted list of versions and removes files that have a newer
 * flavor. Also removes empty versions.
 * @param versions
 * @param opts
 */
function stripFiles(versions) {
	var i, j;
	var flavorValues, flavorKey, flavorKeys = {};

	for (i = 0; i < versions.length; i++) {
		for (j = 0; j < versions[i].files.length; j++) {

			// if non-table file, skip
			if (!versions[i].files[j].flavor) {
				continue;
			}

			flavorValues = [];
			for (var key in flavor.values) {
				//noinspection JSUnfilteredForInLoop
				flavorValues.push(versions[i].files[j].flavor[key]);
			}
			flavorKey = flavorValues.join(':');

			// strip if already available
			if (flavorKeys[flavorKey]) {
				versions[i].files[j] = null;
			}
			flavorKeys[flavorKey] = true;
		}

		versions[i].files = _.compact(versions[i].files);

		// remove version if no more files
		if (versions[i].files.length === 0) {
			versions[i] = null;
		}
	}
	return _.compact(versions);
}