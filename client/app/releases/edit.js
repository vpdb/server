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
 * Main controller containing the form for editing a release.
 */
angular.module('vpdb.releases.edit', [])
	.controller('ReleaseFileEditCtrl', function($scope, $state, $stateParams, $uibModal, $rootScope,
												ApiHelper, AuthService, Flavors,
												GameResource, ReleaseResource, TagResource) {
		// init page
		$scope.theme('light');
		$scope.setMenu('releases');
		$scope.setTitle('Edit Release');

		$scope.newLink = {};
		$scope.editAuthors = false;
		$scope.flavors = Flavors;

		// fetch objects
		$scope.game = GameResource.get({ id: $stateParams.id });
		$scope.release = ReleaseResource.get({ release: $stateParams.releaseId }, function(release) {

			$scope.reset();
			$scope.tags = TagResource.query(function() {
				if (release && release.tags.length > 0) {
					// only push tags that aren't assigned yet.
					$scope.tags = _.filter($scope.tags, function(tag) {
						return !_.contains(_.map(release.tags, 'id'), tag.id);
					});
				}
			});
			$scope.editAuthors = AuthService.getUser().id === release.created_by.id;
		});

		/**
		 * Resets the data to current release.
		 */
		$scope.reset = function() {
			$scope.updatedRelease = _.pick(angular.copy($scope.release), [ 'name', 'description', 'tags', 'links', 'acknowledgements', 'authors' ]);
			$scope.errors = {};
		};

		/**
		 * Adds OR edits an author.
		 * @param {object} author If set, edit this author, otherwise add a new one.
		 */
		$scope.addAuthor = function(author) {
			var meta = { users: {} };
			if (author) {
				meta.users[author.user.id] = author.user;
			}
			$uibModal.open({
				templateUrl: '/releases/modal-author-add.html',
				controller: 'ChooseAuthorCtrl',
				resolve: {
					release: function() { return $scope.updatedRelease; },
					meta: function() { return meta; },
					author: function() { return author; }
				}
			}).result.then(function(newAuthor) {

				// add or edit?
				if (author) {
					$scope.updatedRelease.authors[$scope.updatedRelease.authors.indexOf(author)] = newAuthor;
				} else {
					$scope.updatedRelease.authors.push(newAuthor);
				}
			});
		};

		/**
		 * Removes an author
		 * @param {object} author
		 */
		$scope.removeAuthor = function(author) {
			$scope.updatedRelease.authors.splice($scope.updatedRelease.authors.indexOf(author), 1);
		};

		/**
		 * Opens the create tag dialog
		 */
		$scope.createTag = function() {
			$uibModal.open({
				templateUrl: '/releases/modal-tag-create.html',
				controller: 'CreateTagCtrl'
			}).result.then(function(newTag) {
				$scope.tags.push(newTag);
			});
		};

		/**
		 * Removes a tag from the release
		 * @param {object} tag
		 */
		$scope.removeTag = function(tag) {
			$scope.updatedRelease.tags.splice($scope.updatedRelease.tags.indexOf(tag), 1);
			$scope.tags.push(tag);
		};

		/**
		 * Adds a link to the release
		 * @param {object} link
		 * @returns {{}}
		 */
		$scope.addLink = function(link) {
			$scope.updatedRelease.links.push(link);
			$scope.newLink = {}
		};

		/**
		 * Removes a link from the release
		 * @param {object} link
		 */
		$scope.removeLink = function(link) {
			$scope.updatedRelease.links = _.filter($scope.updatedRelease.links, function(l) {
				return l.label !== link.label || l.url !== link.url;
			});
		};

		$scope.editVersion = function(version) {
			$uibModal.open({
				templateUrl: '/releases/modal-version-edit.html',
				controller: 'VersionEditCtrl',
				size: 'lg',
				resolve: {
					release: function() { return $scope.release; },
					version: function() { return version; }
				}
			}).result.then(function(newAuthor) {

			});
		};

		/**
		 * Posts the release add form to the server.
		 */
		$scope.submit = function() {

			var release = angular.copy($scope.updatedRelease);

			// map tags
			release._tags = _.map(release.tags, 'id');
			delete release.tags;

			// map authors
			if ($scope.editAuthors) {
				release.authors = _.map(release.authors, function(author) {
					author._user = author.user.id;
					delete author.user;
					return author;
				});
			} else {
				delete release.authors;
			}

			ReleaseResource.update({ release: $scope.release.id }, release, function() {
				$state.go('releaseDetails', $stateParams);
				$rootScope.showNotification('Successfully updated release.');

			}, ApiHelper.handleErrors($scope));
		};

		$scope.flattenBuilds = function(builds) {
			return _.map(builds, function(build) {
				return build.label;
			}).join(', ');
		};
	}
).controller('VersionEditCtrl', function($scope, $uibModalInstance, release, version, BootstrapTemplate) {

	BootstrapTemplate.patchCalendar();

	$scope.version = version;
	$scope.version = version;

});