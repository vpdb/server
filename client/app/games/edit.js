"use strict"; /* global _, angular */

angular.module('vpdb.games.edit', [])

	.controller('AdminGameEditCtrl', function($scope, $stateParams, GameResource) {

		var arrayFields = [ 'artists', 'designers', 'themes' ];
		$scope.theme('light');
		$scope.setTitle('Edit Game');
		$scope.setMenu('admin');

		$scope.game = GameResource.get({ id: $stateParams.id }, function() {
			_.each(arrayFields, function(what) {
				$scope.arrays[what] = $scope.game[what].join(', ');
			});
		});

		$scope.gameTypes = [
			{ name: 'Solid State', value: 'ss' },
			{ name: 'Electro-mechanic', value: 'em' },
			{ name: 'Pure mechanical', value: 'pm'}
		];
		$scope.arrays = {};


	});