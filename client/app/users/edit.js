"use strict"; /* global _, angular */

angular.module('vpdb.users.edit', [])

	.controller('AdminUserEditCtrl', function($scope, $rootScope, $uibModalInstance, ApiHelper,
						  UserResource, PlanResource, user, roles) {

		var fields = [ 'id', 'name', 'email', 'username', 'is_active', 'roles', '_plan' ];

		$scope.user = {};
		$scope.roles = roles;
		$scope.originalName = user.name;

		$scope.user = _.pick(user, fields);
		$scope.user._plan = user.plan.id;

		$scope.plans = PlanResource.query();

		$scope.toggleSelection = function toggleSelection(roleName) {
			var idx = $scope.user.roles.indexOf(roleName);
			// is currently selected
			if (idx > -1) {
				$scope.user.roles.splice(idx, 1);
			}
			// is newly selected
			else {
				$scope.user.roles.push(roleName);
			}
		};

		$scope.save = function() {
			var updatedUser = UserResource.update({ userid: $scope.user.id }, $scope.user, function() {
				angular.copy(updatedUser, user);
				if ($rootScope.auth.user.id === $scope.user.id) {
					$rootScope.auth.user = updatedUser;
				}
				$uibModalInstance.close();
			}, ApiHelper.handleErrors($scope));
		};

		$scope.reset = function() {
			$scope.user = _.pick(user, fields);
		};

	});


