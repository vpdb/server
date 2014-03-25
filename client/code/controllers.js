'use strict';

/* Controllers */

var ctrl = angular.module('vpdb.controllers', []);

ctrl.controller('AppCtrl', function($scope, $http) {

	$http({
		method: 'GET',
		url: '/api/name'

	}).success(function(data, status, headers, config) {
		$scope.name = data.name;

	}).error(function(data, status, headers, config) {
		$scope.name = 'Error!';
	});

});


ctrl.controller('CollapseCtrl', function($scope) {
	$scope.isCollapsed  = false;
});


ctrl.controller('CommentCtrl', function($scope) {
});
