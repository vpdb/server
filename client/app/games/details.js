"use strict"; /* global _ */

angular.module('vpdb.games.details', [])

	.controller('GameController', function($scope, $stateParams, $modal, $log, $upload, $localStorage,
					ApiHelper, Flavors, ModalService, DisplayService, ConfigService,
					GameResource, ReleaseCommentResource) {

		$scope.theme('dark');
		$scope.setMenu('games');

		$scope.gameId = $stateParams.id;
		$scope.pageLoading = true;
		$scope.flavors = Flavors;
		$scope.newRoms = $localStorage.game_data && $localStorage.game_data[$scope.gameId] ? $localStorage.game_data[$scope.gameId].roms : [];
		$scope.meta = $localStorage.game_meta && $localStorage.game_meta[$scope.gameId] ? $localStorage.game_meta[$scope.gameId] : {};
		$scope.romUploadCollapsed = $scope.newRoms.length === 0;
		$scope.romLanguages = [
			{ value: 'en', label: 'English' },
			{ value: 'es', label: 'Spanish' },
			{ value: 'de', label: 'German' },
			{ value: 'it', label: 'Italian' },
			{ value: 'fr', label: 'French' }
		];


		/**
		 * meta is data that is needed to render the view but not sent to the server
		 * @returns {*}
		 */
		var meta = function() {
			if (!$localStorage.game_meta) {
				$localStorage.game_meta = {};
			}
			if (!$localStorage.game_meta[$scope.gameId]) {
				$localStorage.game_meta[$scope.gameId] = {
					romFiles: []
				};
			}
			$scope.meta = $localStorage.game_meta[$scope.gameId];
			return $localStorage.game_meta[$scope.gameId];
		};
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
					roms: []
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
		 * When file(s) are dropped to the ROM upload drop zone
		 * @param {array} $files
		 */
		$scope.onRomUpload = function($files) {

			// 1. validate file types
			for (var i = 0; i < $files.length; i++) {
				var file = $files[i];
				var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();
				if (!_.contains(['application/zip'], file.type) && !_.contains(['zip'], ext)) {
					return ModalService.info({
						icon: 'ext-rom',
						title: 'ROM Upload',
						subtitle: 'Wrong file type!',
						message: 'Please upload a ZIP archive.'
					});
				}
			}

			// 2. upload files
			_.each($files, function(upload) {
				var fileReader = new FileReader();
				fileReader.readAsArrayBuffer(upload);
				fileReader.onload = function(event) {
					var type = upload.type;
					var file = {
						name: upload.name,
						bytes: upload.size,
						icon: 'ext-rom',
						uploaded: false,
						uploading: true,
						progress: 0
					};
					meta().romFiles.push(file);
					$upload.http({
						url: ConfigService.storageUri('/files'),
						method: 'POST',
						params: { type: 'rom' },
						headers: {
							'Content-Type': type || 'application/zip',
							'Content-Disposition': 'attachment; filename="' + upload.name + '"'
						},
						data: event.target.result
					}).then(function(response) {
						file.uploading = false;
						file.storage = response.data;
						data().roms.push({
							_file: response.data.id,
							id: upload.name.substr(0, upload.name.lastIndexOf('.')),
							version: '1.0',
							notes: '',
							language: 'en-US'
						});
						console.log('data().roms = ' + data().roms);
						console.log('$scope.newRoms = ' + $scope.newRoms);

					}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading file.', function() {
						meta().romFiles.splice(meta().romFiles.indexOf(file), 1);
					}), function (evt) {
						file.progress = parseInt(100.0 * evt.loaded / evt.total);
					});
				};
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

	.controller('ReleaseController', function($scope, ApiHelper, ReleaseCommentResource) {

		$scope.newComment = '';
		$scope.addComment = function(releaseId) {
			ReleaseCommentResource.save({ releaseId: releaseId }, { message: $scope.newComment }, function(comment) {
				$scope.release.comments.unshift(comment);
				$scope.newComment = '';
			}, ApiHelper.handleErrors($scope));
		};
	})


	.controller('DownloadGameCtrl', function($scope, $modalInstance, $timeout, Flavors, ConfigService, AuthService, params) {

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
				$scope.downloadBody = JSON.stringify($scope.downloadRequest);
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


