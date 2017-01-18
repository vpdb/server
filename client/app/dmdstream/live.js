"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		$scope.dmdIds = [];
		$scope.socket = io('http://localhost:3000');
		$scope.socket.on('producers', function(dmdIds) {
			$scope.dmdIds = dmdIds;
			_.each(dmdIds, function(id) {
				$scope.socket.emit('subscribe', id);
			});
			$scope.$apply();
		});
		$scope.socket.emit('getProducers');
	});
