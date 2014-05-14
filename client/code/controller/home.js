ctrl.controller('HomeController', function($scope, $http) {

	$scope.packs = [];
	$scope.newReleases = [];
	$scope.updatedReleases = [];
	$scope.feed = [];
	$scope.users = [];

	$scope.setMenu('home');

	$http({
		method: 'GET',
		url: '/api-mock/packs'
	}).success(function(data, status, headers, config) {
		$scope.packs = data.result;
	});

	$http({
		method: 'GET',
		url: '/api-mock/releases?show=new'
	}).success(function(data, status, headers, config) {
		$scope.newReleases = data.result;
	});

	$http({
		method: 'GET',
		url: '/api-mock/releases?show=updated'
	}).success(function(data, status, headers, config) {
		$scope.updatedReleases = data.result;
	});

	$http({
		method: 'GET',
		url: '/api-mock/feed'
	}).success(function(data, status, headers, config) {
		$scope.feed = data.result;
	});

	$http({
		method: 'GET',
		url: '/api-mock/users'
	}).success(function(data, status, headers, config) {
		$scope.users = data.result;
	});

});