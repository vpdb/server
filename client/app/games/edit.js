"use strict"; /* global _, angular */

angular.module('vpdb.games.edit', [])

	.controller('AdminGameEditCtrl', function($scope, $rootScope, $state, $stateParams, ApiHelper, AuthService, GameResource) {

		var arrayFields = [ 'keywords', 'artists', 'designers', 'themes' ];
		var updateableFields = ['title', 'year', 'manufacturer', 'game_type', 'short', 'description', 'instructions',
			'produced_units', 'model_number', 'themes', 'designers', 'artists', 'features', 'notes', 'toys', 'slogans',
			'_backglass', '_logo', 'keywords', 'ipdb' ];
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
		};

		$scope.systems = [
			{ id: 44, long: 'Atari Generation/System 1', short: 'System 1' },
			{ id: 45, long: 'Atari Generation/System 2', short: 'System 2' },
			{ id: 48, long: 'Atari Generation/System 3', short: 'System 3' },
			{ id: 20, long: 'Bally MPU A082-91494-A000', short: 'MPU A082' },
			{ id: 38, long: 'Bally MPU A084-91786-AH06 (6803)', short: 'MPU A084' },
			{ id: 19, long: 'Bally MPU AS-2518-133', short: 'MPU 133' },
			{ id: 13, long: 'Bally MPU AS-2518-17', short: 'MPU 17' },
			{ id: 18, long: 'Bally MPU AS-2518-35', short: 'MPU 35' },
			{ id: 32, long: 'Capcom A0015405', short: 'A0015405' },
			{ id: 22, long: 'DataEast/Sega Version 1', short: 'Sega 1' },
			{ id: 23, long: 'DataEast/Sega Version 2', short: 'Sega 2' },
			{ id: 24, long: 'DataEast/Sega Version 3', short: 'Sega 3' },
			{ id: 25, long: 'DataEast/Sega Version 3b', short: 'Sega 3b' },
			{ id: 62, long: 'Day One D1PSB', short: 'D1PSB' },
			{ id: 46, long: 'Game Plan MPU-1', short: 'MPU-1' },
			{ id: 47, long: 'Game Plan MPU-2', short: 'MPU-2' },
			{ id: 14, long: 'Gottlieb System 1', short: 'System 1' },
			{ id: 37, long: 'Gottlieb System 3', short: 'System 3' },
			{ id: 15, long: 'Gottlieb System 80', short: 'System 80' },
			{ id: 16, long: 'Gottlieb System 80A', short: 'System 80A' },
			{ id: 17, long: 'Gottlieb System 80B', short: 'System 80B' },
			{ id: 55, long: 'Mr. Game 1B11188/0', short: '1B11188' },
			{ id: 59, long: 'NSM Control-Unit 217838', short: 'NSM 217838' },
			{ id: 60, long: 'PinHeck System', short: 'PinHeck' },
			{ id: 49, long: 'Playmatic MPU 1', short: 'MPU 1' },
			{ id: 50, long: 'Playmatic MPU 2', short: 'MPU 2' },
			{ id: 51, long: 'Playmatic MPU 3', short: 'MPU 3' },
			{ id: 52, long: 'Playmatic MPU 4', short: 'MPU 4' },
			{ id: 53, long: 'Playmatic MPU 5', short: 'MPU 5' },
			{ id: 64, long: 'Playmatic MPU C', short: 'MPU C' },
			{ id: 39, long: 'Recel System III', short: 'Recel III' },
			{ id: 58, long: 'Sega 95534', short: '95534' },
			{ id: 56, long: 'Sega 95680', short: '95680' },
			{ id: 57, long: 'Sega 96054', short: '96054' },
			{ id: 33, long: 'Sega/Stern Whitestar', short: 'Whitestar' },
			{ id: 21, long: 'Stern M-100 MPU', short: 'M-100' },
			{ id: 34, long: 'Stern M-200 MPU', short: 'M-200' },
			{ id: 54, long: 'Stern S.A.M. Board System', short: 'Stern S.A.M.' },
			{ id: 61, long: 'Stern SPIKE™ System', short: 'Stern SPIKE™' },
			{ id: 41, long: 'Stern Whitestar (modified)', short: 'Stern Whitestar' },
			{ id: 40, long: 'Technoplay "2-2C 8008 LS" (68000 CPU)', short: '2-2C 8008' },
			{ id: 12, long: 'Williams Pinball 2000', short: 'Pinball 2000' },
			{ id: 6, long: 'Williams System 11', short: 'System 11' },
			{ id: 7, long: 'Williams System 11A', short: 'System 11A' },
			{ id: 8, long: 'Williams System 11B', short: 'System 11B' },
			{ id: 9, long: 'Williams System 11C', short: 'System 11C' },
			{ id: 1, long: 'Williams System 3', short: 'System 3' },
			{ id: 2, long: 'Williams System 4', short: 'System 4' },
			{ id: 3, long: 'Williams System 6', short: 'System 6' },
			{ id: 43, long: 'Williams System 6A', short: 'System 6A' },
			{ id: 4, long: 'Williams System 7', short: 'System 7' },
			{ id: 42, long: 'Williams System 8', short: 'System 8' },
			{ id: 5, long: 'Williams System 9', short: 'System 9' },
			{ id: 10, long: 'Williams WPC (Alpha Numeric)', short: 'Williams WPC' },
			{ id: 29, long: 'Williams WPC (DCS)', short: 'Williams WPC' },
			{ id: 27, long: 'Williams WPC (Dot Matrix)', short: 'Williams WPC' },
			{ id: 28, long: 'Williams WPC (Fliptronics 1)', short: 'Williams WPC' },
			{ id: 31, long: 'Williams WPC (Fliptronics 2)', short: 'Williams WPC' },
			{ id: 30, long: 'Williams WPC Security (WPC-S)', short: 'Williams WPC' },
			{ id: 11, long: 'Williams WPC-95', short: 'Williams WPC-95' },
			{ id: 35, long: 'Zaccaria Generation 1', short: 'Generation 1' },
			{ id: 36, long: 'Zaccaria Generation 2', short: 'Generation 2' }
		];
	});