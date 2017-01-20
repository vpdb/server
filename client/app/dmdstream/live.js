"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		$scope.dmdIds = [];
		$scope.socket = io('https://api-test.vpdb.io');
		//$scope.socket = io('http://localhost:3000');
		$scope.socket.on('producers', function(dmdIds) {
			$scope.dmdIds = dmdIds;
			_.each(dmdIds, function(id) {
				$scope.socket.emit('subscribe', id);
			});
			$scope.$apply();
		});
		$scope.socket.emit('getProducers');

		$scope.socket.on('producer', function(data) {
			$scope.dmdIds.push(data.id);
			$scope.socket.emit('subscribe', data.id);
			$scope.$apply();
		});

		$scope.socket.on('stop', function(data) {
			$scope.dmdIds.splice($scope.dmdIds.indexOf(data.id), 1);
			$scope.$apply();
		});
	});
