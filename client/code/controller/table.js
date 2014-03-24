ctrl.controller('TableController', function($scope, $http, $routeParams) {

	$scope.tableId = $routeParams.id;

	$http({
		method: 'GET',
		url: '/api/table/' + $scope.tableId

	}).success(function(data, status, headers, config) {
		var table = data.result;
		table.lastrelease = new Date(table.lastrelease).getTime();

		$scope.table = table;
	});
});
