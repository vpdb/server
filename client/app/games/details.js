"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $rootScope, $stateParams, $uibModal, $log, $localStorage,
					ApiHelper, Flavors, ModalService, DisplayService, ConfigService, DownloadService, AuthService,
					GameResource, ReleaseCommentResource, FileResource, RomResource, GameRatingResource, GameStarResource,
										   UserResource) {

		$scope.theme('dark');
		$scope.setMenu('games');

		$scope.gameId = $stateParams.id;
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
			$scope.setTitle($scope.game.title);
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
				//$scope.gameRating = result.value;
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

//		$scope.requestModPermission = function(release) {
//			var modalInstance = $uibModal.open({
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

	.controller('RequestModPermissionModalCtrl', function($scope, $modalInstance) {

		$scope.ok = function () {
			$modalInstance.close(true);
		};

		$scope.cancel = function () {
			$modalInstance.dismiss(false);
		};
	});