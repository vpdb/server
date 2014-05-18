ctrl.controller('AdminUserCtrl', function($scope, $modal, UserResource, RolesResource) {

	$scope.theme('light');
	$scope.setMenu('admin');
	$scope.users = UserResource.query();
	$scope.roles = RolesResource.query();

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

});

ctrl.controller('AdminUserEditCtrl', function($scope, $modalInstance, UserResource, user, roles) {

	$scope.user = {};
	$scope.roles = roles;
	angular.copy(user, $scope.user);

	var handleErrors = function(response) {
		$scope.message = null;
		$scope.errors = {};
		$scope.error = null;
		if (response.data.errors) {
			_.each(response.data.errors, function(err) {
				$scope.errors[err.field] = err.message;
			});
		}
		if (response.data.error) {
			$scope.error = response.data.error;
		}
	};

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
			$modalInstance.close();
		}, handleErrors);
	};

	$scope.reset = function() {
		angular.copy(user, $scope.user);
	};

});

