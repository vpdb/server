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

/**
 * Main controller containing the form for adding a new release.
 */
angular.module('vpdb.releases.add', []).controller('ReleaseFileAddCtrl', function(
	$scope, $controller, $state, $stateParams, $localStorage, $uibModal,
	ApiHelper, AuthService, ModalService, ReleaseMeta, Flavors,
	GameResource, ReleaseVersionResource, TrackerService
) {

	// use add-common.js
	angular.extend(this, $controller('ReleaseAddBaseCtrl', { $scope: $scope }));

	// init page
	$scope.theme('light');
	$scope.setMenu('releases');
	$scope.setTitle('Upload Files');

	$scope.submitting = false;
	$scope.showHelp = $localStorage.show_instructions.version_add;
	$scope.$watch('showHelp', function() {
		$localStorage.show_instructions.version_add = $scope.showHelp;
	});

	// define flavors and builds
	$scope.flavors = _.values(Flavors);
	$scope.fetchBuilds();

	// fetch game info
	$scope.game = GameResource.get({ id: $stateParams.id }, function() {
		$scope.release = _.find($scope.game.releases, { id: $stateParams.releaseId });
		if ($scope.release) {
			$scope.setTitle('Upload Files - ' + $scope.game.title + ' (' + $scope.release.name + ')');
			TrackerService.trackPage();

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

	$scope.selectPlayfield = function(file) {
		$uibModal.open({
			templateUrl: '/releases/modal-select-playfield.html',
			controller: 'SelectPlayfieldCtrl',
			resolve: {
				params: function() {
					return {
						release: $scope.release,
						file: file
					};
				}
			}
		}).result.then(function(playfieldImage) {
			var playfieldImageKey = $scope.getMediaKey(file, 'playfield_image');
			$scope.meta.mediaFiles[playfieldImageKey] = createMeta(playfieldImage, playfieldImageKey);
			$scope.meta.mediaLinks[playfieldImageKey] = createLink(playfieldImage, 'landscape');
			if (playfieldImage.file_type === 'playfield-fs') {
				$scope.meta.mediaLinks[playfieldImageKey].rotation = 90;
				$scope.meta.mediaLinks[playfieldImageKey].offset = -90;
			}
			file._playfield_image = playfieldImage.id;
		});
	};

	$scope.canSelectPlayfield = function(file) {
		return getCompatiblePlayfieldImages($scope.release, file).length > 0;
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
		$scope.meta.idMap = {};

		// release
		if (!$localStorage.release_version) {
			$localStorage.release_version = {};
		}
		$scope.releaseVersion = $localStorage.release_version[$scope.release.id] = {
			version: '',
			changes: '*New update!*\n\nChanges:\n\n- Added 3D objects\n- Table now talks.',
			files: [ ]
		};
		$scope.errors = {};
		$scope.filesError = null;
		$scope.releaseFileRefs = {};

		// TODO remove files via API (playfield only when not copied)
	};

	/** Posts the release add form to the server. */
	$scope.submit = function() {

		// retrieve rotation parameters
		var rotationParams = [];
		_.forEach($scope.releaseVersion.files, function(file) {
			if (!file._playfield_image) {
				return;
			}
			var rotation = $scope.meta.mediaLinks[$scope.getMediaKey(file, 'playfield_image')].rotation;
			var offset = $scope.meta.mediaLinks[$scope.getMediaKey(file, 'playfield_image')].offset || 0;
			var relativeRotation = rotation + offset;
			rotationParams.push(file._playfield_image + ':' + relativeRotation);
		});

		// only post files
		if ($scope.meta.mode == 'newFile') {

			if (_.isEmpty($scope.releaseVersion.files)) {
				$scope.filesError = 'You should probably try adding at least one file...';
				return;
			}

			$scope.submitting = true;
			ReleaseVersionResource.update({ releaseId: $scope.release.id, version: $scope.meta.version, rotate: rotationParams.join(',') }, { files: $scope.releaseVersion.files }, function() {
				$scope.submitting = false;
				$scope.reset();
				ModalService.info({
					icon: 'check-circle',
					title: 'Success!',
					subtitle: $scope.game.title + ' - ' + $scope.release.name,
					message: 'Successfully uploaded new files to version ' + $scope.meta.version + '.'
				});

				// go to game page
				$state.go('releaseDetails', { id: $stateParams.id, releaseId: $scope.release.id });

			}, ApiHelper.handleErrors($scope, { fieldPrefix: 'versions.0.' }, function(scope) {
				$scope.submitting = false;
				// if it's an array, those area displayed below
				if (!_.isArray(scope.errors.versions[0].files)) {
					scope.filesError = scope.errors.versions[0].files;
				} else {
					scope.filesError = null;
				}
			}));

		// post whole version
		} else {

			// get release date
			var releaseDate = $scope.getReleaseDate();
			if (releaseDate) {
				$scope.releaseVersion.released_at = releaseDate;
			} else {
				delete $scope.releaseVersion.released_at;
			}

			$scope.submitting = true;
			ReleaseVersionResource.save({ releaseId: $scope.release.id, rotate: rotationParams.join(',') }, $scope.releaseVersion, function() {
				$scope.submitting = false;
				$scope.reset();
				ModalService.info({
					icon: 'check-circle',
					title: 'Success!',
					subtitle: $scope.game.title + ' - ' + $scope.release.name,
					message: 'Successfully uploaded new release version.'
				});

				// go to game page
				$state.go('releaseDetails', { id: $stateParams.id, releaseId: $scope.release.id });

			}, ApiHelper.handleErrors($scope, { fieldPrefix: 'versions.0.' }, function(scope) {
				$scope.submitting = false;
				// if it's an array, those area displayed below
				if (!_.isArray(scope.errors.versions[0].files)) {
					scope.filesError = scope.errors.versions[0].files;
				} else {
					scope.filesError = null;
				}
			}));
		}

	};

}).controller('SelectPlayfieldCtrl', function($scope, params) {
	$scope.images = getCompatiblePlayfieldImages(params.release, params.file);
});


function getCompatiblePlayfieldImages(release, file) {
	var images = [];
	_.forEach(release.versions, function(version) {
		_.forEach(version.files, function(f) {
			if ((f.flavor.orientation === 'any' || f.flavor.orientation === file.flavor.orientation) && (f.flavor.lighting === 'any' || f.flavor.lighting === file.flavor.lighting)) {
				images.push({ version: version, image: f.playfield_image });
			}
		})
	});
	return images;
}


function createMeta(file, key) {
	return {
		name: file.name,
		bytes: file.bytes,
		mimeType: file.mime_type,
		icon: 'ext-vp' + (/table-x$/i.test(file.mime_type) ? 'x' : 't'),
		randomId: file._randomId,
		storage: file,
		key: key
	};
}

function createLink(file, variation) {
	return {
		url: file.variations[variation].url,
		is_protected: file.variations[variation].is_protected,
		rotation: 0
	};
}