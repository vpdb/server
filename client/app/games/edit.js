"use strict"; /* global _, angular */

angular.module('vpdb.games.edit', [])

	.controller('AdminGameEditCtrl', function($scope, $rootScope, $state, $stateParams, ApiHelper, AuthService, GameResource) {

		var arrayFields = [ 'keywords', 'artists', 'designers', 'themes' ];
		var updateableFields = ['title', 'year', 'manufacturer', 'game_type', 'short', 'description', 'instructions',
			'produced_units', 'model_number', 'themes', 'designers', 'artists', 'features', 'notes', 'toys', 'slogans',
			'_backglass', '_logo', 'keywords' ];
		var maxAspectRatioDifference = 0.2;

		$scope.theme('light');
		$scope.setTitle('Edit Game');
		$scope.setMenu('admin');

		GameResource.get({ id: $stateParams.id }, function(game) {
			$scope.originalGame = angular.copy(game);
			$scope.reset(game);
		});

		$scope.gameTypes = [
			{ name: 'Solid State', value: 'ss' },
			{ name: 'Electro-mechanic', value: 'em' },
			{ name: 'Pure mechanical', value: 'pm'}
		];
		$scope.arrays = {};


		/**
		 * Backglass has been uploaded.
		 * Calculates AR and updates games object.
		 * @param status
		 */
		$scope.onBackglassUpload = function(status) {

			var bg = status.storage;

			AuthService.collectUrlProps(bg, true);
			$scope.game._backglass = bg.id;
			$scope.game.mediaFile.backglass = bg;

			var ar = Math.round(bg.metadata.size.width / bg.metadata.size.height * 1000) / 1000;
			var arDiff = Math.abs(ar / 1.25 - 1);

			$scope.backglass = {
				dimensions: bg.metadata.size.width + '×' + bg.metadata.size.height,
				test: ar === 1.25 ? 'optimal' : (arDiff < maxAspectRatioDifference ? 'warning' : 'error'),
				ar: ar,
				arDiff: Math.round(arDiff * 100)
			};
		};


		/**
		 * Logo has been uploaded.
		 * Updates game object.
		 * @param status
		 */
		$scope.onLogoUpload = function(status) {
			var logo = status.storage;

			AuthService.collectUrlProps(logo, true);
			$scope.game._logo = logo.id;
			$scope.game.mediaFile.logo = logo;
		};


		/**
		 * Callback when media gets deleted before it gets re-uploaded.
		 * @param key
		 */
		$scope.onMediaClear = function(key) {
			$scope.game.mediaFile[key] = {
				url: false,
				variations: {
					'medium-2x': { url: false }
				}
			};
			$scope.$emit('imageUnloaded');
		};


		/**
		 * Posts the release add form to the server.
		 */
		$scope.submit = function() {

			var game = _.pick(angular.copy($scope.game), updateableFields);

			// restore arrays
			_.each(arrayFields, function(what) {
				game[what] = $scope.arrays[what].split(/,\s*/);
			});

			GameResource.update({ id: $scope.game.id }, game, function() {
				$state.go('gameDetails', $stateParams);
				$rootScope.showNotification('Successfully updated game.');

			}, ApiHelper.handleErrors($scope));
		};


		/**
		 * Resets all field to is original data
		 * @param game Original data
		 */
		$scope.reset = function(game) {
			$scope.game = angular.copy(game);

			_.each(arrayFields, function(what) {
				$scope.arrays[what] = game[what].join(', ');
			});
			$scope.game.mediaFile = _.pick(game, [ 'backglass', 'logo' ]);
			$scope.errors = {};
		}
	});