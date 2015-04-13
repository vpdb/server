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
angular.module('vpdb.releases.add', []).controller('ReleaseAddCtrl', function(
	$scope, $upload, $modal, $window, $localStorage, $state, $stateParams, $location, $anchorScroll, $timeout,
	AuthService, ConfigService, DisplayService, MimeTypeService, ModalService, ApiHelper, Flavors, ReleaseMeta,
	ReleaseResource, FileResource, TagResource, BuildResource, GameResource)
{

	// init page
	$scope.theme('light');
	$scope.setMenu('admin');
	$scope.setTitle('Add Release');

	// define flavors
	$scope.flavors = _.values(Flavors);

	// fetch game info
	$scope.game = GameResource.get({ id: $stateParams.id }, function() {
		$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();
		$scope.release._game = $scope.game.id;
		$scope.setTitle('Add Release - ' + $scope.game.title);
	});

	// retrieve available tags
	$scope.tags = TagResource.query(function() {
		if ($scope.release && $scope.release._tags.length > 0) {
			// only push tags that aren't assigned yet.
			$scope.tags = _.filter($scope.tags, function(tag) {
				return !_.contains($scope.release._tags, tag.id);
			});
		}
	});

	// cache those...
	var releaseFileRefs = {};

	// retrieve available vp builds
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

	// init data: either copy from local storage or reset.
	if ($localStorage.release) {
		$scope.release = $localStorage.release;
		$scope.meta = $localStorage.release_meta;

		// update references
		//_.each($scope.release.versions[0].files, function(file) {
		//	var metaFile = _.find($scope.meta.files, function(f) { return f.storage.id === file._file; });
		//	//metaFile.tableFile = file;
		//});
		AuthService.collectUrlProps($scope.meta, true);

	} else {
		$scope.reset();
	}

	/**
	 * Resets all entered data
	 */
	$scope.reset = function() {
		var currentUser = AuthService.getUser();

		/*
		 * `meta` is all the data we need for displaying the page but that
		 * is not part of the release object posted to the API.
		 */
		$scope.meta = $localStorage.release_meta = _.cloneDeep(ReleaseMeta);
		$scope.meta.users[currentUser.id] = currentUser;
		$scope.newLink = {};

		// TODO remove files via API

		/*
		 * `release` is the object posted to the API.
		 */
		$scope.release = $localStorage.release = {
			_game: $scope.game.id,
			name: '',
			description: '',
			versions: [ {
				version: '',
				changes: '*Initial release.*',
				files: [ ]
			} ],
			authors: [ {
				_user: currentUser.id,
				roles: [ 'Table Creator' ]
			} ],
			_tags: [ ],
			links: [ ],
			acknowledgements: '',
			original_version: null
		};
		$scope.errors = {};
		releaseFileRefs = {};
	};


	/**
	 * Deletes an uploaded file from the server and removes it from the list
	 * @param {object} file
	 */
	$scope.removeFile = function(file) {
		FileResource.delete({ id: file.storage.id }, function() {
			$scope.meta.files.splice($scope.meta.files.indexOf(file), 1);
			$scope.release.versions[0].files.splice(_.indexOf($scope.release.versions[0].files, _.findWhere($scope.release.versions[0].files, { id : file.storage.id })), 1);

		}, ApiHelper.handleErrorsInDialog($scope, 'Error removing file.'));
	};


	/**
	 * Adds OR edits an author.
	 * @param {object} author If set, edit this author, otherwise add a new one.
	 */
	$scope.addAuthor = function(author) {
		$modal.open({
			templateUrl: '/releases/modal-author-add.html',
			controller: 'ChooseAuthorCtrl',
			resolve: {
				release: function() { return $scope.release; },
				meta: function() { return $scope.meta; },
				author: function() { return author; }
			}
		}).result.then(function(newAuthor) {

			// here we're getting the full object, so store the user object in meta.
			var authorRef = { _user: newAuthor.user.id, roles: newAuthor.roles };
			$scope.meta.users[newAuthor.user.id] = newAuthor.user;

			// add or edit?
			if (author) {
				$scope.release.authors[$scope.release.authors.indexOf(author)] = authorRef;
			} else {
				$scope.release.authors.push(authorRef);
			}
		});
	};


	/**
	 * Removes an author
	 * @param {object} author
	 */
	$scope.removeAuthor = function(author) {
		$scope.release.authors.splice($scope.release.authors.indexOf(author), 1);
	};


	/**
	 * Opens the create tag dialog
	 */
	$scope.createTag = function() {
		$modal.open({
			templateUrl: '/releases/modal-tag-create.html',
			controller: 'CreateTagCtrl'
		}).result.then(function(newTag) {
				$scope.tags.push(newTag);
			});
	};


	/**
	 * When a tag is dropped
	 */
	$scope.tagDropped = function() {
		$scope.release._tags = _.pluck($scope.meta.tags, 'id');
	};


	/**
	 * Removes a tag from the release
	 * @param {object} tag
	 */
	$scope.removeTag = function(tag) {
		$scope.meta.tags.splice($scope.meta.tags.indexOf(tag), 1);
		$scope.tags.push(tag);
		$scope.release._tags = _.pluck($scope.meta.tags, 'id');
	};


	/**
	 * Adds a link to the release
	 * @param {object} link
	 * @returns {{}}
	 */
	$scope.addLink = function(link) {
		$scope.release.links.push(link);
		return {};
	};


	/**
	 * Removes a link from the release
	 * @param {object} link
	 */
	$scope.removeLink = function(link) {
		$scope.release.links.splice($scope.release.links.indexOf(link), 1);
	};


	/**
	 * Adds or removes a build to/from to a given file of the release
	 * @param {object} meta file
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
		} else {
			tableFile = { _file: status.storage.id };
		}
		$scope.release.versions[0].files.push(tableFile);
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

		console.log($scope.release);

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
		if (!releaseFileRefs[metaReleaseFile.storage.id]) {
			releaseFileRefs[metaReleaseFile.storage.id] = _.find($scope.release.versions[0].files, { _file: metaReleaseFile.storage.id });
		}
		return releaseFileRefs[metaReleaseFile.storage.id];
	};

	/**
	 * Returns the file object of the release object that is sent to the
	 * API for given meta file info stored at $scope.meta.mediaFiles.
	 * @param metaMediaFile
	 * @returns {*}
	 */
	$scope.getReleaseFileForMedia = function(metaMediaFile) {
		return _.find($scope.release.versions[0].files, { _file: metaMediaFile.key.split(':')[1] });
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
	 * Posts the release add form to the server.
	 */
	$scope.submit = function() {

		// add link if user has started typing something.
		if ($scope.newLink && ($scope.newLink.label || $scope.newLink.url)) {
			$scope.addLink($scope.newLink);
		}
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
})

.controller('CreateTagCtrl', function($scope, $modalInstance, ApiHelper, TagResource) {

	$scope.tag = {};
	$scope.create = function() {
		TagResource.save($scope.tag, function(tag) {
			$modalInstance.close(tag);

		}, ApiHelper.handleErrors($scope));
	};
})

.filter('allowedFlavors', function() {
	return function(flavors, file) {
		if (file) {
			var ext = file.name.substr(file.name.lastIndexOf('.')).toLowerCase();
			if (ext !== '.vpx') {
				return _.omit(flavors, 'any');
			}
		}
		return flavors;
	};
});