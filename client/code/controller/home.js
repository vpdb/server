ctrl.controller('HomeController', function($scope, $http) {

	$scope.packs = [];
	$scope.releases = [];

	$http({
		method: 'GET',
		url: '/api/packs'
	}).success(function(data, status, headers, config) {
		$scope.packs = data.result;
	});

	$http({
		method: 'GET',
		url: '/api/releases'
	}).success(function(data, status, headers, config) {
		$scope.releases = data.result;
	});

});