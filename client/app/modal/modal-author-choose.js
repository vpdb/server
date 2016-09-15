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

angular.module('vpdb.common', []).controller('ChooseAuthorCtrl', function($scope, $uibModalInstance, UserResource, subject, meta, author) {

	if (author) {
		var userId = author._user || author.user.id;
		$scope.author = author;
		$scope.user = meta.users[userId];
		$scope.roles = author.roles.slice();
		$scope.query = meta.users[userId].name;
		$scope.isValidUser = true;
	} else {
		$scope.user = null;
		$scope.roles = [];
		$scope.isValidUser = false;
	}
	$scope.adding = author ? false : true;
	$scope.errors = {};
	$scope.subject = subject;
	$scope.role = '';
	$scope.searching = false;

	$scope.findUser = function(val) {
		return UserResource.query({ q: val }).$promise;
	};

	$scope.userSelected = function(item, model) {
		$scope.user = model;
		$scope.isValidUser = true;
	};

	$scope.queryChange = function() {
		$scope.isValidUser = false;
	};

	$scope.addRole = function(role) {
		if (role && !~$scope.roles.indexOf(role)) {
			$scope.roles.push(role);
		}
		$scope.role = '';
	};

	$scope.removeRole = function(role) {
		$scope.roles.splice($scope.roles.indexOf(role), 1);
	};

	$scope.add = function() {
		$scope.addRole($scope.role);

		var valid = true;

		// user validations
		if (!$scope.isValidUser) {
			$scope.errors.user = 'You must select an existing user. Typing after selecting a user erases the selected user.';
			valid = false;
		} else if (_.filter($scope.subject.authors, function(author) { return author._user === $scope.user.id; }).length > 0 &&
			($scope.adding || $scope.user.id !== $scope.author._user)) {
			$scope.errors.user = 'User "' + $scope.user.name + '" is already added as author.';
			valid = false;
		} else {
			delete $scope.errors.user;
		}

		// scope validations
		if ($scope.roles.length === 0) {
			$scope.errors.roles = 'Please add at least one role.';
			valid = false;
		} else if ($scope.roles.length > 3) {
			$scope.errors.roles = 'Three is the maxmimal number of roles an author can have. Please group roles if that\'s not enough.';
			valid = false;
		} else {
			delete $scope.errors.roles;
		}

		if (valid) {
			$uibModalInstance.close({ user: $scope.user, roles: $scope.roles });
		}
	};
});