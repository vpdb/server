ctrl.controller('HomeController', function($scope, $http) {

	$scope.packs = [];
	$scope.newReleases = [];
	$scope.updatedReleases = [];
	$scope.feed = [];
	$scope.users = [];

	$scope.setMenu('home');

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

	$http({
		method: 'GET',
		url: '/api/feed'
	}).success(function(data, status, headers, config) {
		$scope.feed = data.result;
	});

	$http({
		method: 'GET',
		url: '/api/users'
	}).success(function(data, status, headers, config) {
		$scope.users = data.result;
	});

});