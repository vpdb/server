ctrl.controller('TableListController', function($scope, $http) {

	$scope.tables = [];

	$http({
		method: 'GET',
		url: '/api/tables'

	}).success(function(data, status, headers, config) {
		$scope.tables = data.result;

	}).error(function(data, status, headers, config) {
		$scope.name = 'Error!';
	});
});
