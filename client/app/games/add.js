"use strict"; /* global _ */

angular.module('vpdb.games.add', [])

	.controller('AdminGameAddCtrl', function($scope, $modal, $window, $localStorage, $location, $state,
											 ApiHelper, AuthService, ConfigService, MimeTypeService, ModalService,
											 IpdbResource, GameResource, FileResource) {

		var maxAspectRatioDifference = 0.2;
		var dropText = {
			backglass: 'Click or drag and drop backglass image here',
			logo: 'Click or drag and drop logo here'
		};

		$scope.theme('light');
		$scope.setTitle('Add Game');
		$scope.setMenu('admin');

		$scope.openUploadDialog = function(selector) {
			angular.element(selector).trigger('click');
		};

		$scope.reset = function() {
			$scope.resetGame();
			$scope.resetMedia();
		};

		$scope.resetMedia = function() {
			$scope.mediaFile = {
				backglass: {
					uploadText: dropText.backglass
				},
				logo: {
					uploadText: dropText.logo
				}
			};
		};

		$scope.resetGame = function() {

			// delete media if already uploaded
			if ($scope.game && !$scope.game.submitted) {
				if ($scope.game.mediaFile.backglass.id) {
					FileResource.delete({ id: $scope.game.mediaFile.backglass.id});
				}
				if ($scope.game.mediaFile.logo.id) {
					FileResource.delete({ id: $scope.game.mediaFile.logo.id});
				}
			}

			$scope.game = $localStorage.newGame = {
				origin: 'recreation',
				ipdbUrl: '',
				links: [{ label: '', url: '' }],
				_media: {},

				mediaFile: {
					backglass: {
						url: false,
						variations: {
							'medium-2x': { url: false }
						}
					},
					logo: {
						url: false
					}
				},
				data: {
					fetched: false,
					year: true,
					idValidated: false
				}
			};
		};

		var fetchIpdb = function(ipdbId, done) {
			$scope.setLoading(true);
			var game = IpdbResource.get({ id: ipdbId }, function() {
				$scope.setLoading(false);

				$scope.game = _.extend($scope.game, game);
				if ($scope.game.short) {
					$scope.game.id = $scope.game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				} else {
					$scope.game.id = $scope.game.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				}
				$scope.errors = {};
				$scope.error = null;
				$scope.game.data.fetched = true;
				$scope.game.data.year = game.year ? true : false;

				if (done) {
					done(null, $scope.game);
				}
			}, ApiHelper.handleErrorsInDialog($scope, 'Error fetching data.'));
		};

		var readIpdbId = function() {
			if (/id=\d+/i.test($scope.game.ipdbUrl)) {
				var m = $scope.game.ipdbUrl.match(/id=(\d+)/i);
				return m[1];

			} else if (parseInt($scope.game.ipdbUrl)) {
				return $scope.game.ipdbUrl;
			} else {
				return false;
			}
		};

		$scope.refresh = function(done) {

			var ipdbId = readIpdbId();
			if (ipdbId) {
				fetchIpdb(ipdbId, done);
			} else {
				ModalService.error({
					title: 'IPDB Fetch',
					subtitle: 'Sorry!',
					message: 'You need to put either the IPDB number or the URL with an ID.'
				});
			}
		};

		$scope.check = function() {

			if (!$scope.game.id) {
				$scope.game.data.idValid = false;
				$scope.game.data.idValidated = true;
				return;
			}

			GameResource.head({ id: $scope.game.id }, function() {
				$scope.game.data.idValid = false;
				$scope.game.data.idValidated = true;
			}, function() {
				$scope.game.data.idValid = true;
				$scope.game.data.idValidated = true;
			});
		};

		$scope.submit = function() {

			var submit = function() {

				$scope.game.game_type =
					$scope.game.origin === 'originalGame' ? 'og' : (
						$scope.game.game_type ? $scope.game.game_type.toLowerCase() : 'na'
					);

				var game = GameResource.save(_.omit($scope.game, ['data', 'mediaFile']), function() {
					var id = $scope.game.id;
					$scope.game.submitted = true;
					$scope.reset();
					ModalService.info({
						icon: 'check-circle',
						title: 'Game Created!',
						subtitle: game.title,
						message: 'The game has been successfully created.'
					});

					// go to game page
					$state.go('gameDetails', { id: id });

				}, ApiHelper.handleErrors($scope));
			};

			// if not yet refreshed, do that first.
			var ipdbId = readIpdbId();
			if ($scope.game.origin === 'recreation' && ipdbId && (!$scope.game.ipdb || !$scope.game.ipdb.number)) {
				fetchIpdb(ipdbId, submit);
			} else {
				submit();
			}
		};

		$scope.onBackglassUpload = function(status) {

			var bg = status.storage;

			AuthService.collectUrlProps(bg, true);
			$scope.game._media.backglass = bg.id;
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

		$scope.onLogoUpload = function(status) {
			var logo = status.storage;

			AuthService.collectUrlProps(logo, true);
			$scope.game._media.logo = logo.id;
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


		$scope.removeLink = function(link) {

		};


		$scope.searchOnIpdb = function() {
			$window.open(angular.element('#ipdbLink').attr('href'));
		};


		$scope.resetMedia();
		if ($localStorage.newGame) {
			$scope.game  = $localStorage.newGame;
			AuthService.collectUrlProps($scope.game, true);

		} else {
			$scope.resetGame();
		}
	});