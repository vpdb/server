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
 * The base controller that parents ReleaseAddCtrl and ReleaseFileAddCtrl.
 */
angular.module('vpdb.releases.add', []).controller('ReleaseAddBaseCtrl', function($scope, $uibModal, ApiHelper, AuthService, BuildResource, FileResource, BootstrapTemplate) {

	BootstrapTemplate.patchCalendar();

	/**
	 * Opens the calendar drop-down.
	 * @param $event
	 */
	$scope.openCalendar = function($event) {
		$event.preventDefault();
		$event.stopPropagation();

		$scope.calendarOpened = true;
	};

	/**
	 * Returns a date object from the date and time picker.
	 * If empty, returns null.
	 */
	$scope.getReleaseDate = function() {
		if ($scope.meta.releaseDate || $scope.meta.releaseTime) {
			var date = $scope.meta.releaseDate ? new Date($scope.meta.releaseDate) : new Date();
			var time = $scope.meta.releaseTime ? new Date($scope.meta.releaseTime) : new Date();
			return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
		}
		return null;
	};

	/**
	 * Splits builds into types (experimental, nightly and release)
	 * and sorts each by date.
	 */
	$scope.fetchBuilds = function() {
		var builds = BuildResource.query(function() {
			$scope.builds = {};
			var types = [];
			_.each(builds, function(build) {
				if (!$scope.builds[build.type]) {
					$scope.builds[build.type] = [];
					types.push(build.type);
				}
				build.built_at = new Date(build.built_at);
				$scope.builds[build.type].push(build);
			});
			_.each(types, function(type) {
				$scope.builds[type].sort(function(a, b) {
					return a.built_at.getTime() === b.built_at.getTime() ? 0 : (a.built_at.getTime() > b.built_at.getTime() ? -1 : 1);
				});
			});
		});
	};


	/**
	 * Adds or removes a build to/from to a given file of the release
	 * @param {object} metaFile file
	 * @param {object} build
	 */
	$scope.toggleBuild = function(metaFile, build) {
		var releaseFile = $scope.getReleaseFile(metaFile);
		var idx = releaseFile._compatibility.indexOf(build.id);
		if (idx > -1) {
			releaseFile._compatibility.splice(idx, 1);
		} else {
			releaseFile._compatibility.push(build.id);
		}
	};


	/**
	 * Opens the dialog for creating a new build.
	 */
	$scope.addBuild = function() {
		$uibModal.open({
			templateUrl: '/releases/modal-build-create.html',
			controller: 'AddBuildCtrl',
			size: 'lg'
		}).result.then(function(newBuild) {
				// todo
			});
	};


	/**
	 * Deletes an uploaded file from the server and removes it from the list
	 * @param {object} file
	 */
	$scope.removeFile = function(file) {
		FileResource.delete({ id: file.storage.id }, function() {
			$scope.meta.files.splice($scope.meta.files.indexOf(file), 1);
			$scope.releaseVersion.files.splice(_.indexOf($scope.releaseVersion.files, _.findWhere($scope.releaseVersion.files, { id : file.storage.id })), 1);

		}, ApiHelper.handleErrorsInDialog($scope, 'Error removing file.'));
	};

	/**
	 * Executed just before uploading of a file starts
	 * @param status
	 */
	$scope.beforeFileUpload = function(status) {

		if (/^application\/x-visual-pinball-table/i.test(status.mimeType)) {
			$scope.releaseVersion.files.push({
				_randomId: status.randomId,
				flavor: {},
				_compatibility: [],
				_playfield_image: null,
				_playfield_video: null
			});
		}
	};

	/**
	 * On error, remove file from release.
	 * @param status
	 */
	$scope.onFileUploadError = function(status) {
		var tableFile = _.findWhere($scope.releaseVersion.files, { _randomId: status.randomId });
		if (tableFile) {
			$scope.releaseVersion.files.splice($scope.releaseVersion.files.indexOf(tableFile), 1);
		}
	};

	/**
	 * Callback when a release file was successfully uploaded.
	 * @param status
	 */
	$scope.onFileUpload = function(status) {
		var tableFile;

		// table files are already there from #beforeFileUpload(), so just find the right one and update
		if (/^application\/x-visual-pinball-table/i.test(status.mimeType)) {
			tableFile = _.findWhere($scope.releaseVersion.files, { _randomId: status.randomId });
			tableFile._file = status.storage.id;

			// get auth tokens for generated screenshot
			if (status.storage.variations && status.storage.variations.screenshot) {
				$scope.meta.mediaLinks['screenshot:' + status._randomId] = status.storage.variations.screenshot;
				AuthService.collectUrlProps(status.storage, true);
			}

			// copy version from table file to form if available
			if (status.storage.metadata && status.storage.metadata.table_version) {
				$scope.releaseVersion.version = status.storage.metadata.table_version;
			}

			// add author's url as well
			if ($scope.addLink && _.isArray($scope.release.links) && $scope.release.links.length === 0 && status.storage.metadata && status.storage.metadata['author_website']) {
				$scope.addLink({ label: 'Author\'s website', url: status.storage.metadata['author_website'] });
			}

		} else {
			// other files need to be added
			$scope.releaseVersion.files.push({ _file: status.storage.id });
		}

		// link randomId to storage id
		$scope.meta.idMap = $scope.randomIdMap || {};
		$scope.meta.idMap[status.randomId] = status.storage.id;
	};


	/**
	 * Callback when a media file was successfully uploaded.
	 * @param status
	 */
	$scope.onMediaUpload = function(status) {

		// update links
		if (/^image\//.test(status.mimeType)) {
			$scope.meta.mediaLinks[status.key] = status.storage.variations['landscape'];

		} else if (/^video\//.test(status.mimeType)) {
			$scope.meta.mediaLinks[status.key] = status.storage.variations['still'];

		} else {
			$scope.meta.mediaLinks[status.key] = status.storage;
		}

		// add to release object
		var releaseFile = $scope.getReleaseFileForMedia(status);
		var mediaType = status.key.split(':')[0];
		releaseFile['_' + mediaType] = status.storage.id;

		// figure out rotation
		if (/^image\//.test(status.mimeType)) {
			$scope.updateRotation(releaseFile, status);
		}

		AuthService.collectUrlProps(status.storage, true);
	};


	/**
	 * Callback when media gets deleted before it gets re-uploaded.
	 * @param key
	 */
	$scope.onMediaClear = function(key) {
		$scope.meta.mediaLinks[key] = false;
	};


	/**
	 * Resets orientation settings.
	 * @param file Release file meta data
	 */
	$scope.onOrientationChanged = function(file) {
		var releaseFile = $scope.getReleaseFile(file);
		var mediaFile = $scope.meta.mediaFiles[$scope.getMediaKey(releaseFile, 'playfield_image')];
		if (mediaFile) {
			$scope.updateRotation(releaseFile, mediaFile);
		}
	};


	/**
	 * Returns the file object of the release object that is sent to the
	 * API for given meta file info stored at $scope.meta.files.
	 *
	 * @param metaReleaseFile
	 * @returns {*}
	 */
	$scope.getReleaseFile = function(metaReleaseFile) {
		$scope.releaseFileRefs = $scope.releaseFileRefs || {};
		if (!$scope.releaseFileRefs[metaReleaseFile.randomId]) {
			$scope.releaseFileRefs[metaReleaseFile.randomId] = _.find($scope.releaseVersion.files, { _randomId: metaReleaseFile.randomId });
		}
		return $scope.releaseFileRefs[metaReleaseFile.randomId];
	};


	/**
	 * Returns the file object of the release object that is sent to the
	 * API for given meta file info stored at $scope.meta.mediaFiles.
	 * @param status Media file
	 * @returns {*}
	 */
	$scope.getReleaseFileForMedia = function(status) {
		return _.find($scope.releaseVersion.files, { _randomId: status.key.split(':')[1] });
	};


	/**
	 * Returns the playfield type for a give meta file at $scope.meta.files.
	 *
	 * @param metaReleaseFile
	 * @returns {string}
	 */
	$scope.getPlayfieldType = function(metaReleaseFile) {
		var releaseFile = $scope.getReleaseFile(metaReleaseFile);
		// fullscreen per default
		return 'playfield-' + (releaseFile && releaseFile.flavor && releaseFile.flavor.orientation === 'ws' ? 'ws' : 'fs');
	};


	/**
	 * Returns the key for media files stored at $scope.meta.mediaFiles.
	 * @param file File status as returned by the file-upload module
	 * @param type media type
	 * @returns {string}
	 */
	$scope.getMediaKey = function(file, type) {
		return type + ':' + (file.randomId || file._randomId);
	};


	/**
	 * Removes the media link from meta data in case a file failed to load
	 * @param file
	 * @param type
	 */
	$scope.onBackglassImageError = function(file, type) {
		//delete $scope.meta.mediaLinks[$scope.getMediaKey(file, type)];
	};


	/**
	 * Updates the rotation offset of an image.
	 *
	 * Updates the `rotation` parameter of the media link, which is used to
	 *
	 *   1. Apply the CSS class for the given rotation to the image's parent
	 *   2. Retrieve pre-processing rotation when posting the release
	 *
	 * @param file Release file
	 * @param type Media type (only "playfield_image" supported for far)
	 * @param angle Angle - either 90 or -90
	 */
	$scope.rotate = function(file, type, angle) {
		var rotation = $scope.meta.mediaLinks[$scope.getMediaKey(file, type)].rotation;
		$scope.meta.mediaLinks[$scope.getMediaKey(file, type)].rotation = (rotation + angle + 360) % 360;
	};


	/**
	 * Best-guesses the rotation of an uploaded playfield.
	 * Run this after media upload or orientation change.
	 *
	 * @param releaseFile File object posted to the API
	 * @param mediaFile Media meta data ("status")
	 */
	$scope.updateRotation = function(releaseFile, mediaFile) {

		var rotation = 0;
		var offset = 0;

		// we use the landscape image from the backend, so if it's a portrait, set offset
		if (mediaFile.storage.metadata.size.width < mediaFile.storage.metadata.size.height) {
			offset = -90;
		}

		// if orientation of the release file is known to be desktop, don't rotate.
		if (releaseFile.flavor && releaseFile.flavor.orientation === 'ws') {
			rotation = 0;

		// otherwise, assume it's a fullscreen release and rotate accordingly.
		} else if (mediaFile.storage.metadata.size.width > mediaFile.storage.metadata.size.height) {
			rotation = 90;
		}

		$scope.meta.mediaLinks[mediaFile.key].rotation = rotation - offset;
		$scope.meta.mediaLinks[mediaFile.key].offset = offset;
	};

});