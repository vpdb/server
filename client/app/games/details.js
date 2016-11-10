"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $rootScope, $stateParams, $uibModal, $log, $localStorage, TrackerService,
					ApiHelper, Flavors, ModalService, DisplayService, ConfigService, DownloadService, AuthService,
					GameResource, ReleaseCommentResource, FileResource, RomResource, GameRatingResource, GameStarResource) {

		$scope.theme('dark');
		$scope.setMenu('games');

		$scope.gameId = $stateParams.id;
		$scope.ldGame = {
			"@context": "http://schema.org/",
			"@type": "Product"
		};
		$scope.pageLoading = true;
		$scope.flavors = Flavors;
		$scope.newRoms = $localStorage.game_data && $localStorage.game_data[$scope.gameId] ? $localStorage.game_data[$scope.gameId].roms : [];
		$scope.roms = RomResource.query({ id : $scope.gameId });
		$scope.romLanguages = [
			{ value: 'en', label: 'English' },
			{ value: 'es', label: 'Spanish' },
			{ value: 'de', label: 'German' },
			{ value: 'it', label: 'Italian' },
			{ value: 'fr', label: 'French' }
		];
		$scope.media = {
			backglass_image: {
				imgclass: ['img--ar-bg'],
				variation: 'medium'
			},
			wheel_image: {
				imgclass: ['img--ar-bg', 'img--fit'],
				variation: 'medium'
			}
		};

		// clear empty meta data
		var isEmpty = function(val) {
			if (_.isObject(val) && _.isEmpty(val)) {
				return false;
			}
			return !!val;
		};
		$localStorage.game_meta = _.pick(_.mapValues($localStorage.game_meta, function(obj) {
			return _.pick(obj, isEmpty)
		}), isEmpty);

		// setup meta data
		if (!$localStorage.game_meta) {
			$localStorage.game_meta = {};
		}
		if (!$localStorage.game_meta[$scope.gameId]) {
			$localStorage.game_meta[$scope.gameId] = {
				romFiles: []
			};
		}
		$scope.meta = $localStorage.game_meta[$scope.gameId];
		$scope.romUploadCollapsed = !$scope.meta || !$scope.meta.romFiles || $scope.meta.romFiles.length === 0;


		/**
		 * data is sent to the server and serves as persistent storage in case of browser refresh
		 * @returns {*}
		 */
		var data = function() {
			if (!$localStorage.game_data) {
				$localStorage.game_data = {};
			}
			if (!$localStorage.game_data[$scope.gameId]) {
				$localStorage.game_data[$scope.gameId] = {
					roms: {}
				};
			}
			$scope.newRoms = $localStorage.game_data[$scope.gameId].roms;
			return $localStorage.game_data[$scope.gameId];
		};

		// GAME
		GameResource.get({ id: $scope.gameId }, function(result) {
			$scope.game = result;
			$scope.pageLoading = false;

			// title
			var title = $scope.game.title;
			if ($scope.game.manufacturer && $scope.game.year) {
				title += ' (' + $scope.game.manufacturer + ' ' + $scope.game.year + ')';
			}
			$scope.setTitle(title);
			TrackerService.trackPage();

			// seo meta
			var keywordItems = [];
			if (!_.isEmpty($scope.game.short)) {
				keywordItems = keywordItems.concat($scope.game.short);
			}
			if (!_.isEmpty($scope.game.keywords)) {
				keywordItems = keywordItems.concat($scope.game.keywords);
			}
			keywordItems.push('visual pinball');
			keywordItems.push('download');
			keywordItems.push('vpt');
			keywordItems.push('vpx');
			keywordItems.push('directb2s');
			keywordItems.push('rom');
			keywordItems.push('pinmame');
			keywordItems.push('vpinmame');
			$scope.setKeywords(keywordItems.join(', '));

			var descriptionItems = [];
			if ($scope.game.owner) {
				descriptionItems.push('Produced by ' + $scope.game.owner);
			}
			if (!_.isEmpty($scope.game.designers)) {
				descriptionItems.push('Designed by ' + $scope.game.designers.join(', '));
			}
			var s = descriptionItems.length == 0 ? '' : ' - ';
			$scope.setDescription(descriptionItems.join(', ') + s + 'Download tables, DirectB2S backglasses, ROMs and more.');

			$scope.hasReleases = $scope.game.releases.length > 0;
			$scope.hasBackglasses = $scope.game.backglasses.length > 0;

			// seo structured data
			$scope.ldGame.name = title;
			$scope.ldGame.image = $scope.game.backglass.variations['medium-2x'].url;
			if ($scope.game.manufacturer) {
				$scope.ldGame.brand = $scope.game.manufacturer;
			}
			if ($scope.game.slogans) {
				$scope.ldGame.description = $scope.game.slogans.split('\n')[0];
			}
			if ($scope.game.rating.votes) {
				$scope.ldGame.aggregateRating = {
					"@type": "AggregateRating",
					"ratingValue": $scope.game.rating.average,
					"bestRating": "10",
					"worstRating": "1",
					"ratingCount": $scope.game.rating.votes
				};
			}
		});

		// RATINGS
		if (AuthService.hasPermission('games/rate')) {
			GameRatingResource.get({gameId: $scope.gameId}).$promise.then(function(result) {
				$scope.gameRating = result.value;
			});
		}

		// STARS
		if (AuthService.hasPermission('games/star')) {
			GameStarResource.get({ gameId: $scope.gameId }).$promise.then(function() {
				$scope.gameStarred = true;
			}, function() {
				$scope.gameStarred = false;
			});
		}

		/**
		 * Callback for ROM uploads
		 * @param status
		 */
		$scope.onRomUpload = function(status) {
			status.romId = status.name.substr(0, status.name.lastIndexOf('.'));
			var basename = status.romId;
			var m = basename.match(/(\d{2,}.?)$/);
			var version = m ? m[1][0]  + '.' + m[1].substr(1) : '';
			data().roms[status.storage.id] = {
				_file: status.storage.id,
				id: status.romId,
				version: version,
				notes: '',
				language: $scope.romLanguages[0]
			};
		};

		/**
		 * Posts all uploaded ROM files to the API
		 */
		$scope.saveRoms = function() {
			_.each(data().roms, function(rom) {
				if (_.isObject(rom.language)) {
					rom.language = rom.language.value;
				}

				// we only allow one language through the UI, the API does multiple however.
				rom.languages = [ rom.language ];
				delete rom.language;

				// post to api
				RomResource.save({ id: $scope.gameId }, rom, function() {
					$scope.roms = RomResource.query({ id : $scope.gameId });
					$scope.meta.romFiles.splice(_.indexOf($scope.meta.romFiles, _.findWhere($scope.meta.romFiles, { id : rom._file })), 1);
					delete data().roms[rom._file];

				}, function(response) {
					if (response.data.errors) {
						_.each(response.data.errors, function(err) {
							_.where($scope.meta.romFiles, { romId: rom.id })[0].error = err.message;
						});
					}
				});
			});
 		};

		/**
		 * Downloads a single ROM
		 * @param rom
		 */
		$scope.downloadRom = function(rom) {
			DownloadService.downloadFile(rom.file, function() {
				rom.file.counter.downloads++;
			});
		};


		/**
		 * Deletes an uploaded file from the server and removes it from the list
		 * @param {object} file
		 */
		$scope.removeRom = function(file) {
			FileResource.delete({ id: file.storage.id }, function() {
				$scope.meta.romFiles.splice($scope.meta.romFiles.indexOf(file), 1);
				delete data().roms[file.storage.id];

			}, ApiHelper.handleErrorsInDialog($scope, 'Error removing file.', function(response) {
				if (response.status === 404) {
					$scope.meta.romFiles.splice($scope.meta.romFiles.indexOf(file), 1);
					delete data().roms[file.storage.id];
					return true;
				}
			}));
		};


		/**
		 * Rates a game.
		 * @param {int} rating Rating
		 */
		$scope.rateGame = function(rating) {
			var done = function(result) {
				$scope.game.rating = result.game;
				$scope.gameRating = rating;
			};
			if ($scope.gameRating) {
				GameRatingResource.update({ gameId: $scope.gameId }, { value: rating }, done);
				$rootScope.showNotification('Successfully updated rating.');

			} else {
				GameRatingResource.save({ gameId: $scope.gameId }, { value: rating }, done);
				$rootScope.showNotification('Successfully rated game!');
			}
		};

		/**
		 * Stars or unstars a game depending if game is already starred.
		 */
		$scope.toggleStar = function() {
			var err = function(err) {
				if (err.data && err.data.error) {
					ModalService.error({
						subtitle: 'Error starring game.',
						message: err.data.error
					});
				} else {
					console.error(err);
				}
			};
			if ($scope.gameStarred) {
				GameStarResource.delete({ gameId: $scope.gameId }, {}, function() {
					$scope.gameStarred = false;
					$scope.game.counter.stars--;
				}, err);

			} else {
				GameStarResource.save({ gameId: $scope.gameId }, {}, function(result) {
					$scope.gameStarred = true;
					$scope.game.counter.stars = result.total_stars;
				}, err);
			}
		};

		$scope.showBackglass = function(backglass) {
			$uibModal.open({
				templateUrl: 'modal/backglass.html',
				controller: 'BackglassDetailCtrl',
				size: 'md',
				resolve: {
					params: function() {
						return {
							game: $scope.game,
							backglass: backglass
						};
					}
				}
			});
		};

		$scope.showMedium = function(medium) {
			$uibModal.open({
				templateUrl: 'modal/medium.html',
				controller: 'MediumDetailCtrl',
				size: 'md',
				resolve: {
					params: function() {
						return {
							game: $scope.game,
							medium: medium
						};
					}
				}
			});
		};
	})

	.controller('BackglassDetailCtrl', function($scope, $uibModalInstance, DownloadService, params) {

		$scope.backglass = params.backglass;
		$scope.game = params.game;
		$scope.file = $scope.backglass.versions[0].file;
		$scope.numDownloads = 0;
		_.each($scope.backglass.versions, function(version) {
			$scope.numDownloads += version.file.counter.downloads;
		});
		$scope.download = function(file) {
			DownloadService.downloadFile(file, function() {
				file.counter.downloads++;
				$scope.numDownloads++;
			});
		}
	})

	.controller('MediumDetailCtrl', function($scope, $timeout, DownloadService, params) {
		$scope.medium = params.medium;
		$scope.game = params.game;

		if ($scope.medium.file.variations.full) {
			$timeout(function() {
				$('#lightbox').magnificPopup({ type: 'image'});
			});
		}

		$scope.download = function(file) {
			DownloadService.downloadFile(file, function() {
				$scope.medium.file.counter.downloads++;
			});
		}
	});
