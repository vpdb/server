ctrl.controller('AdminUserCtrl', function($scope, $modal, UserResource, RolesResource) {

	$scope.theme('light');
	$scope.setMenu('admin');
	$scope.users = UserResource.query();
	$scope.roles = RolesResource.query();

	var firstLoad = true;

	$scope.edit = function(user) {
		$modal.open({
			templateUrl: 'partials/modals/admin-userEdit',
			controller: 'AdminUserEditCtrl',
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

	$scope.$watch("query", $.debounce(350, function() {
		if (!firstLoad || $scope.query) {
			$scope.users = UserResource.query({ q: $scope.query });
			firstLoad = false;
		}
	}), true);

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
		UserResource.update({ userid: $scope.user._id }, $scope.user, function() {
			angular.copy($scope.user, user);
			if ($rootScope.user.obj._id == $scope.user._id) {
				$rootScope.user.obj = $scope.user;
			}
			$modalInstance.close();
		}, ApiHelper.handleErrors($scope));
	};

	$scope.reset = function() {
		angular.copy(user, $scope.user);
	};

});

