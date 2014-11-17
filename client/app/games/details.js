"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $http, $routeParams, $modal, $log, GameResource) {

		$scope.theme('dark');
		$scope.setMenu('games');

		$scope.gameId = $routeParams.id;
		$scope.pageLoading = true;

		$scope.accordeon = {
			isFirstOpen: true
		};

		$scope.game = GameResource.get({ id: $scope.gameId }, function() {

			$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();

			_.each($scope.game.releases, function(release) {

				release.versions = _.sortBy(release.versions, 'version');
				release.__latestVersion = release.versions[0];
			});

			setTimeout(function() {
				$('.image-link').magnificPopup({
					type: 'image',
					removalDelay: 300,
					mainClass: 'mfp-fade'
				});
			}, 0);
			$scope.pageLoading = false;
			$scope.setTitle($scope.game.title);
		});

		$scope.requestModPermission = function(release) {
			var modalInstance = $modal.open({
				templateUrl: '/partials/modals/requestModPermission.html',
				controller: 'RequestModPermissionModalCtrl'
			});

			modalInstance.result.then(function (selectedItem) {
				$scope.selected = selectedItem;
			}, function () {
				$log.info('Modal dismissed at: ' + new Date());
			});
		};
	})


	.controller('RequestModPermissionModalCtrl', function($scope, $modalInstance) {

		$scope.ok = function () {
			$modalInstance.close(true);
		};

		$scope.cancel = function () {
			$modalInstance.dismiss(false);
		};
	})


	/**
	 * Formats a rating so it always displays one decimal.
	 */
	.filter('rating', function() {

		return function(rating) {
			rating = parseFloat(rating);
			if (!rating) {
				return ' — ';
			}
			if (Math.round(rating) === rating && rating < 10) {
				return rating + '.0';
			} else {
				return Math.round(rating * 10) / 10;
			}
		};
	})

	.filter('dlRelease', function() {
		return function(data) {
			var game = data[0];
			var release = data[1];
			return [ game.name, release.title ];
		};
	})

	.filter('dlRom', function() {
		return function(data) {
			var game = data[0];
			var rom = data[1];
			return [ game.name, 'ROM <samp>' + rom.name + '</samp>' ];
		};
	})

	.filter('dlBackglass', function() {
		return function(data) {
			var game = data[0];
			var backglass = data[1];
			return [ game.name, 'Backglass by <strong>' + backglass.author.user + '</strong>' ];
		};
	})

	.filter('dlMedia', function(DisplayService) {
		return function(data) {
			var game = data[0];
			var media = data[1];
			return [
				game.name,
					DisplayService.media(media.type) + ' (' + media.format + ') by <strong>' + media.author.user + '</strong>'
			];
		};
	})

	.filter('dlPack', function() {
		return function(pack) {
			return [
					pack.manufacturer + ' ' + pack.number,
				pack.name
			];
		};
	});


