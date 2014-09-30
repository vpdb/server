"use strict"; /* global ctrl, _*/

ctrl.controller('AdminUserCtrl', function($scope, $modal, UserResource, RolesResource) {

	$scope.theme('light');
	$scope.setTitle('Users');
	$scope.setMenu('admin');
	$scope.users = UserResource.query();
	$scope.roles = RolesResource.query();

	$scope.filterRole = [];

	var firstLoad = true;

	$scope.edit = function(user) {
		$modal.open({
			templateUrl: 'partials/admin/modals/user-edit.html',
			controller: 'AdminUserEditCtrl',
			size: 'lg',
			resolve: {
				user: function () {
					return user;
				},
				roles: function () {
					return $scope.roles;
				}
			}
		});
	};

	var refresh = function() {
		var query = {};
		if (!firstLoad || $scope.query) {
			query.q = $scope.query;
			firstLoad = false;
		}
		if ($scope.filterRole.length > 0) {
			query.roles = $scope.filterRole.join(',');
		}

		$scope.users = UserResource.query(query);
	};

	$scope.$watch("query", $.debounce(350, function() {
		if (!firstLoad || $scope.query) {
			refresh();
		}
	}), true);

	$scope.$on('dataToggleRole', function(event, role) {
		if (_.contains($scope.filterRole, role)) {
			$scope.filterRole.splice($scope.filterRole.indexOf(role), 1);
		} else {
			$scope.filterRole.push(role);
		}
		$scope.$apply();
		refresh();
	});

});

ctrl.controller('AdminUserEditCtrl', function($scope, $rootScope, $modalInstance, ApiHelper, UserResource, user, roles) {

	$scope.user = {};
	$scope.roles = roles;
	$scope.originalName = user.name;
	angular.copy(user, $scope.user);

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
		UserResource.update({ userid: $scope.user.id }, $scope.user, function() {
			angular.copy($scope.user, user);
			if ($rootScope.auth.user.id === $scope.user.id) {
				$rootScope.auth.user = $scope.user;
			}
			$modalInstance.close();
		}, ApiHelper.handleErrors($scope));
	};

	$scope.reset = function() {
		angular.copy(user, $scope.user);
	};

});

