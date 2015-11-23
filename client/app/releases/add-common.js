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
 * The base controller that parents ReleaseAddCtrl and ReleaseFileAddCtrl.
 */
angular.module('vpdb.releases.add', []).controller('ReleaseAddBaseCtrl', function($scope, $modal, ApiHelper, AuthService, BuildResource, FileResource, BootstrapTemplate) {


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
		$modal.open({
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
	 * Callback when a release file was successfully uploaded.
	 * @param status
	 */
	$scope.onFileUpload = function(status) {
		var tableFile;
		if (/^application\/x-visual-pinball-table/i.test(status.mimeType)) {
			tableFile = {
				_file: status.storage.id,
				flavor: {},
				_compatibility: [],
				_media: {
					playfield_image: null,
					playfield_video: null
				}
			};

			if (status.storage.variations && status.storage.variations.screenshot) {
				$scope.meta.mediaLinks['screenshot:' + status.storage.id] = status.storage.variations.screenshot;
				AuthService.collectUrlProps(status.storage, true);
			}

			// copy version from table file to form if available
			if (status.storage.metadata && status.storage.metadata.TableVersion) {
				$scope.releaseVersion.version = status.storage.metadata.TableVersion;
			}

			// add author's url as well
			if ($scope.addLink && _.isArray($scope.release.links) && $scope.release.links.length === 0 && status.storage.metadata && status.storage.metadata.AuthorWebSite) {
				$scope.addLink({ label: 'Author\'s website', url: status.storage.metadata.AuthorWebSite });
			}

		} else {
			tableFile = { _file: status.storage.id };
		}
		$scope.releaseVersion.files.push(tableFile);
	};


	/**
	 * Callback when a media file was successfully uploaded.
	 * @param status
	 */
	$scope.onMediaUpload = function(status) {

		// update links
		if (/^image\//.test(status.mimeType)) {
			$scope.meta.mediaLinks[status.key] = status.storage.variations['medium-landscape'];

		} else if (/^video\//.test(status.mimeType)) {
			$scope.meta.mediaLinks[status.key] = status.storage.variations.still;

		} else {
			$scope.meta.mediaLinks[status.key] = status.storage;
		}

		// add to release object
		var releaseFile = $scope.getReleaseFileForMedia(status);
		var mediaType = status.key.split(':')[0];
		releaseFile._media[mediaType] = status.storage.id;

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
	 * Returns the file object of the release object that is sent to the
	 * API for given meta file info stored at $scope.meta.files.
	 *
	 * @param metaReleaseFile
	 * @returns {*}
	 */
	$scope.getReleaseFile = function(metaReleaseFile) {
		$scope.releaseFileRefs = $scope.releaseFileRefs || {};
		if (!$scope.releaseFileRefs[metaReleaseFile.storage.id]) {
			$scope.releaseFileRefs[metaReleaseFile.storage.id] = _.find($scope.releaseVersion.files, { _file: metaReleaseFile.storage.id });
		}
		return $scope.releaseFileRefs[metaReleaseFile.storage.id];
	};


	/**
	 * Returns the file object of the release object that is sent to the
	 * API for given meta file info stored at $scope.meta.mediaFiles.
	 * @param metaMediaFile
	 * @returns {*}
	 */
	$scope.getReleaseFileForMedia = function(metaMediaFile) {
		return _.find($scope.releaseVersion.files, { _file: metaMediaFile.key.split(':')[1] });
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
		return type + ':' + file.storage.id;
	};


	/**
	 * Removes the media link from meta data in case a file failed to load
	 * @param file
	 * @param type
	 */
	$scope.onBackglassImageError = function(file, type) {
		delete $scope.meta.mediaLinks[type + ':' + file.storage.id];
	}
});