"use strict"; /* global _, angular */

angular.module('vpdb.games.edit', [])

	.controller('AdminGameEditCtrl', function($scope, $rootScope, $state, $stateParams, ApiHelper, GameResource) {

		var arrayFields = [ 'artists', 'designers', 'themes' ];
		var updateableFields = ['title', 'year', 'manufacturer', 'game_type', 'short', 'description', 'instructions',
			'produced_units', 'model_number', 'themes', 'designers', 'artists', 'features', 'notes', 'toys', 'slogans' ];
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

		/**
		 * Posts the release add form to the server.
		 */
		$scope.submit = function() {

			var game = _.pick(angular.copy($scope.game), updateableFields);

			// restore arrays
			_.each(arrayFields, function(what) {
				game[what] = $scope.arrays[what].split(/,\s+/);
			});

			GameResource.update({ id: $scope.game.id }, game, function() {
				$state.go('gameDetails', $stateParams);
				$rootScope.showNotification('Successfully updated game.');

			}, ApiHelper.handleErrors($scope));
		};
	});