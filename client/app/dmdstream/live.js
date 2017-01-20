"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		$scope.dmdIds = [];
		//$scope.socket = io('https://api-test.vpdb.io');
		$scope.socket = io('http://localhost:3000');
		$scope.socket.on('producers', function(dmdIds) {
			$scope.dmdIds = dmdIds;
			console.log('Subscribing to all streams: [ %s ]', dmdIds.join(','));
			_.each(dmdIds, function(id) {
				$scope.socket.emit('subscribe', id);
			});
			$scope.$apply();
		});
		$scope.socket.emit('getProducers');

		$scope.socket.on('producer', function(data) {
			$scope.dmdIds.push(data.id);
			$scope.socket.emit('subscribe', data.id);
			console.log('New stream %s, subscribing.', data.id);
			$scope.$apply();
		});

		$scope.socket.on('stop', function(data) {
			var idx = $scope.dmdIds.indexOf(data.id);
			if (idx > -1) {
				console.log('Removing stream %s', data.id);
				$scope.dmdIds.splice(idx, 1);
			}
			$scope.$apply();
		});
	});
