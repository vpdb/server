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

/**
 * Main controller containing the form for adding a new release.
 */
angular.module('vpdb.releases.add', []).controller('ReleaseFileAddCtrl', function(
	$scope, $controller, $state, $stateParams, $localStorage,
	ApiHelper, AuthService, ModalService, ReleaseMeta, Flavors,
	GameResource, ReleaseVersionResource
) {

	// use add-common.js
	angular.extend(this, $controller('ReleaseAddBaseCtrl', { $scope: $scope }));

	// init page
	$scope.theme('light');
	$scope.setMenu('releases');
	$scope.setTitle('Upload Files');

	// define flavors and builds
	$scope.flavors = _.values(Flavors);
	$scope.fetchBuilds();

	// fetch game info
	$scope.game = GameResource.get({ id: $stateParams.id }, function() {
		$scope.release = _.find($scope.game.releases, { id: $stateParams.releaseId });
		if ($scope.release) {
			$scope.setTitle('Upload Files - ' + $scope.game.title + ' (' + $scope.release.name + ')');

			// populate versions
			$scope.versions = _.pluck(_.sortByOrder($scope.release.versions, 'released_at', false), 'version');

			// init data: either copy from local storage or reset.
			if ($localStorage.release_version && $localStorage.release_version[$scope.release.id]) {
				$scope.releaseVersion = $localStorage.release_version[$scope.release.id];
				$scope.meta = $localStorage.release_version_meta[$scope.release.id];
				AuthService.collectUrlProps($scope.meta, true);
			} else {
				$scope.reset();
			}
		}
	});

	// steps
	$scope.step = {
		files: 1,
		flavors: 2,
		compat: 3,
		media: 4
	};

	/** Resets all entered data */
	$scope.reset = function() {

		// meta
		if (!$localStorage.release_version_meta) {
			$localStorage.release_version_meta = {};
		}
		$scope.meta = $localStorage.release_version_meta[$scope.release.id] = _.cloneDeep(ReleaseMeta);
		$scope.meta.mode = 'newFile';
		$scope.meta.version = $scope.versions[0];

		// release
		if (!$localStorage.release_version) {
			$localStorage.release_version = {};
		}
		$scope.releaseVersion = $localStorage.release_version[$scope.release.id] = {
			version: '',
			changes: '*New update!*\n\nChanges:\n\n- Added 3D objects\n-Table now talks.',
			files: [ ]
		};
		$scope.errors = {};
		$scope.releaseFileRefs = {};

		// TODO remove files via API
	};

	/** Posts the release add form to the server. */
	$scope.submit = function() {

		// only post files
		if ($scope.meta.mode == 'newFile') {

			ReleaseVersionResource.update({ releaseId: $scope.release.id, version: $scope.meta.version }, { files: $scope.releaseVersion.files }, function() {
				$scope.reset();
				ModalService.info({
					icon: 'check-circle',
					title: 'Success!',
					subtitle: $scope.game.title + ' - ' + $scope.release.name,
					message: 'Successfully uploaded new files to version ' + $scope.meta.version + '.'
				});

				// go to game page
				$state.go('gameDetails', { id: $stateParams.id });

			}, ApiHelper.handleErrors($scope, { fieldPrefix: 'versions.0.' }));

		// post whole version
		} else {

			// get release date
			var releaseDate = $scope.getReleaseDate();
			if (releaseDate) {
				$scope.releaseVersion.released_at = releaseDate;
			} else {
				delete $scope.releaseVersion.released_at;
			}

			ReleaseVersionResource.save({ releaseId: $scope.release.id }, $scope.releaseVersion, function() {
				$scope.reset();
				ModalService.info({
					icon: 'check-circle',
					title: 'Success!',
					subtitle: $scope.game.title + ' - ' + $scope.release.name,
					message: 'Successfully uploaded new release version.'
				});

				// go to game page
				$state.go('gameDetails', { id: $stateParams.id });

			}, ApiHelper.handleErrors($scope, { fieldPrefix: 'versions.0.' }));
		}

	};

});