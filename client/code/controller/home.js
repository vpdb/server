ctrl.controller('HomeController', function($scope, $http) {

	$scope.packs = [];
	$http({
		method: 'GET',
		url: '/api/packs'
	}).success(function(data, status, headers, config) {
		$scope.packs = data.result;
	});

});