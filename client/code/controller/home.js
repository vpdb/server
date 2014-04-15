ctrl.controller('HomeController', function($scope, $http) {

	$scope.packs = [];
	$scope.newReleases = [];
	$scope.updatedReleases = [];

	$http({
		method: 'GET',
		url: '/api/packs'
	}).success(function(data, status, headers, config) {
		$scope.packs = data.result;
	});

	$http({
		method: 'GET',
		url: '/api/releases?show=new'
	}).success(function(data, status, headers, config) {
		$scope.newReleases = data.result;
	});

	$http({
		method: 'GET',
		url: '/api/releases?show=updated'
	}).success(function(data, status, headers, config) {
		$scope.updatedReleases = data.result;
	});


});