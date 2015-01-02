"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $http, $stateParams, $modal, $log, Flavors, GameResource) {

		$scope.theme('dark');
		$scope.setMenu('games');

		$scope.gameId = $stateParams.id;
		$scope.pageLoading = true;

		$scope.accordeon = {
			isFirstOpen: true
		};
		$scope.flavors = Flavors;

		$scope.game = GameResource.get({ id: $scope.gameId }, function() {

			$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();

			_.each($scope.game.releases, function(release) {

				release.versions = _.sortBy(release.versions, 'version');
				release.__latestVersion = release.versions[0];
				release.__portraitShots = _.compact(_.map(release.__latestVersion.files, function(file) {
					if (!file.media || !file.media.playfield_image || file.media.playfield_image.file_type !== 'playfield-fs') {
						return null;
					}
					return { url: file.media.playfield_image.variations.medium.url };
				}));
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

		$scope.download = function(game, release) {
			$modal.open({
				templateUrl: '/games/modal-download.html',
				controller: 'DownloadGameCtrl',
				size: 'lg',
				resolve: {
					params: function() {
						return {
							game: game,
							release: release
						};
					}
				}
			});
		};

//		$scope.requestModPermission = function(release) {
//			var modalInstance = $modal.open({
//				templateUrl: '/partials/modals/requestModPermission.html',
//				controller: 'RequestModPermissionModalCtrl'
//			});
//
//			modalInstance.result.then(function (selectedItem) {
//				$scope.selected = selectedItem;
//			}, function () {
//				$log.info('Modal dismissed at: ' + new Date());
//			});
//		};

		// todo refactor (make it more useful)
		$scope.tableFile = function(file) {
			return file.file.mime_type && /^application\/x-visual-pinball-table/i.test(file.file.mime_type);
		};
	})


	.controller('DownloadGameCtrl', function($scope, $modalInstance, $http, $timeout, Flavors, ConfigService, AuthService, params) {

		$scope.game = params.game;
		$scope.release = params.release;
		$scope.flavors = Flavors;

		$scope.downloadFiles = {};
		$scope.downloadRequest = {
			files: [],
			media: {
				playfield_image: true,
				playfield_video: false
			},
			game_media: true
		};

		$scope.download = function() {
			var path = '/releases/' + $scope.release.id;
			var url = ConfigService.storageUri(path);
			AuthService.fetchUrlTokens(url, function(err, tokens) {
				// todo treat error
				$scope.downloadLink = ConfigService.storageUri(path, true);
				$scope.downloadBody= JSON.stringify($scope.downloadRequest);
				$scope.downloadToken = tokens[url];
				$timeout(function() {
					angular.element('#downloadForm').submit();
					$modalInstance.close(true);
				}, 0);
			});
		};

		$scope.toggleFile = function(file) {
			if ($scope.downloadFiles[file.file.id]) {
				delete $scope.downloadFiles[file.file.id];
			} else {
				$scope.downloadFiles[file.file.id] = file;
			}
			$scope.downloadRequest.files = _.values(_.pluck(_.pluck($scope.downloadFiles, 'file'), 'id'));
		};



		// todo refactor (make it more useful)
		$scope.tableFile = function(file) {
			return file.file.mime_type && /^application\/x-visual-pinball-table/i.test(file.file.mime_type);
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


