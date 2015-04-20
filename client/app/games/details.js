"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $rootScope, $stateParams, $modal, $log, $upload, $localStorage,
					ApiHelper, Flavors, ModalService, DisplayService, ConfigService, DownloadService,
					AuthService,
					GameResource, ReleaseCommentResource, FileResource, RomResource, GameRatingResource) {

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
				release.comments = ReleaseCommentResource.query({ releaseId: release.id });
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

		/**
		 * Opens the game download dialog
		 *
		 * @param game Game
		 * @param release Release to download
		 */
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


		// RATINGS
		if (AuthService.isAuthenticated) {
			GameRatingResource.get({ gameId: $scope.gameId }).$promise.then(function(rating) {
				$scope.gameRating = rating;
			});
		}
		$scope.rateGame = function(rating) {
			var done = function(result) {
				$scope.game.rating = result.game;
				$scope.gameRating = result.game;
			};
			if ($scope.gameRating) {
				GameRatingResource.update({ gameId: $scope.gameId }, { value: rating }, done);
				$rootScope.showNotification('Successfully updated rating.');

			} else {
				GameRatingResource.save({ gameId: $scope.gameId }, { value: rating }, done);
				$rootScope.showNotification('Successfully rated game!');
			}
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

	.controller('DownloadGameCtrl', function($scope, $modalInstance, $timeout, Flavors, DownloadService, params) {

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
			game_media: true,
			roms: false
		};

		$scope.download = function() {
			DownloadService.downloadRelease($scope.release.id, $scope.downloadRequest, function() {
				$modalInstance.close(true);
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
	});