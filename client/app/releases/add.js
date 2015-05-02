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
	$scope, $upload, $modal, $window, $localStorage, $state, $stateParams, $location, $anchorScroll, $timeout, $controller,
	AuthService, ConfigService, DisplayService, MimeTypeService, ModalService, ApiHelper, Flavors, ReleaseMeta,
	ReleaseResource, FileResource, TagResource, BuildResource, GameResource)
{
	// use add-common.js
	angular.extend(this, $controller('ReleaseAddBaseCtrl', { $scope: $scope }));

	// init page
	$scope.theme('light');
	$scope.setMenu('releases');
	$scope.setTitle('Add Release');

	// define flavors and builds
	$scope.flavors = _.values(Flavors);
	$scope.fetchBuilds();

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

	// init data: either copy from local storage or reset.
	if ($localStorage.release) {
		$scope.release = $localStorage.release;
		$scope.releaseVersion = $scope.release.versions[0];
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

	$scope.step = {
		files: 1,
		flavors: 3,
		compat: 5,
		media: 7
	};
	$scope.newLink = {};

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
		$scope.releaseVersion = $scope.release.versions[0];
		$scope.errors = {};
		$scope.releaseFileRefs = {};
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
		$scope.newLink = {}
	};


	/**
	 * Removes a link from the release
	 * @param {object} link
	 */
	$scope.removeLink = function(link) {
		$scope.release.links = _.filter($scope.release.links, function(l) {
			return l.label !== link.label || l.url !== link.url;
		});
	};


	/**
	 * Posts the release add form to the server.
	 */
	$scope.submit = function() {

		// get release date
		var releaseDate = $scope.getReleaseDate();
		if (releaseDate) {
			$scope.release.versions[0].released_at = releaseDate;
		} else {
			delete $scope.release.versions[0].released_at;
		}

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

		}, ApiHelper.handleErrors($scope, function(scope) {
			// if it's an array, those area displayed below
			if (_.isArray(scope.errors.versions[0].files)) {
				delete scope.errors.versions[0].files;
			}
		}));
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