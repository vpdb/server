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
	$scope, $controller, $stateParams, $localStorage,
	ApiHelper, AuthService, ModalService, ReleaseMeta, Flavors,
	GameResource, ReleaseResource)
{

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


	/** Resets all entered data */
	$scope.reset = function() {

		// meta
		if (!$localStorage.release_version_meta) {
			$localStorage.release_version_meta = {};
		}
		$scope.meta = $localStorage.release_version_meta[$scope.release.id] = _.cloneDeep(ReleaseMeta);
		$scope.meta.mode = 'newFile';

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

		ReleaseResource.save($scope.release, function() {
			$scope.release.submitted = true;
			$scope.reset();

			ModalService.info({
				icon: 'check-circle',
				title: 'Release created!',
				subtitle: $scope.game.title,
				message: 'The release has been successfully created.'
			});

			// go to game page
			$state.go('gameDetails', { id: $stateParams.id });

		}, ApiHelper.handleErrors($scope));
	};

});