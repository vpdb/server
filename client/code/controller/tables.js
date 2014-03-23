ctrl.controller('TableListController', function($scope, $http, $location) {

	if ($location.$$hash == 'extended') {
		$scope.viewtype = 'extended';
	} else if ($location.$$hash == 'list') {
		$scope.viewtype = 'list';
	} else {
		$scope.viewtype = 'compact'
	}
	$scope.template = '/partials/table-' + $scope.viewtype;

	$http({
		method: 'GET',
		url: '/api/tables'

	}).success(function(data, status, headers, config) {
		_.each(data.result, function(table) {
			table.lastrelease = new Date(table.lastrelease).getTime();
		});
		$scope.tables = data.result;

	});
});
