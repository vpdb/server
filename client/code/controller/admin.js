ctrl.controller('AdminUserCtrl', function($scope, UserResource) {

	$scope.theme('light');
	$scope.setMenu('admin');
	$scope.users = UserResource.query();

});

