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

angular.module('vpdb.common', []).controller('ChooseGameCtrl', function($scope, $uibModalInstance, GameResource) {

	$scope.errors = {};
	$scope.searching = false;

	$scope.findGame = function(val) {
		return GameResource.query({ q: val }).$promise;
	};

	$scope.gameSelected = function(item, model) {
		$scope.game = model;
		$scope.isValidGame = true;
	};

	$scope.queryChange = function() {
		$scope.isValidGame = false;
	};

	$scope.add = function() {
		$scope.addRole($scope.role);

		var valid = true;

		// user validations
		if (!$scope.isValidGame) {
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