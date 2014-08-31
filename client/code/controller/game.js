"use strict";

/*global ctrl, _*/
ctrl.controller('GameController', function($scope, $http, $routeParams, $modal, $log, GameResource) {

	$scope.theme('dark');
	$scope.setMenu('games');

	$scope.gameId = $routeParams.id;
	$scope.pageLoading = true;

	$scope.accordeon = {
		isFirstOpen: true
	};

	$scope.game = GameResource.get({ id: $scope.gameId }, function() {

		$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();

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
			templateUrl: 'partials/modals/requestModPermission.html',
			controller: 'RequestModPermissionModalCtrl'
		});

		modalInstance.result.then(function (selectedItem) {
			$scope.selected = selectedItem;
		}, function () {
			$log.info('Modal dismissed at: ' + new Date());
		});
	};
});

ctrl.controller('RequestModPermissionModalCtrl', function($scope, $modalInstance) {

	$scope.ok = function () {
		$modalInstance.close(true);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss(false);
	};
});

ctrl.controller('AdminGameAddCtrl', function($scope, $upload, $modal, $window, $localStorage, $location, $anchorScroll, ApiHelper, AuthService, MimeTypeService, IpdbResource, GameResource, FileResource) {

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
		if (!$scope.game.submitted) {
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
			$modal.open({
				templateUrl: 'partials/modals/info.html',
				controller: 'InfoModalCtrl',
				resolve: {
					icon: function() { return 'fa-warning'; },
					title: function() { return 'IPDB Fetch'; },
					subtitle: function() { return 'Sorry!'; },
					message: function() { return 'You need to put either the IPDB number or the URL with an ID.'; }
				}
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
				$scope.game.submitted = true;
				$scope.reset();
				$modal.open({
					templateUrl: 'partials/modals/info.html',
					controller: 'InfoModalCtrl',
					resolve: {
						icon: function() { return 'fa-check-circle-o'; },
						title: function() { return 'Game Created!'; },
						subtitle: function() { return game.title; },
						message: function() { return 'The game has been successfully created.'; }
					}
				});
				$location.hash('top');
				$anchorScroll();

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

	$scope.onMediaUpload = function(id, type, restrictMime, $files, onSuccess) {

		var file = $files[0];
		var mimeType = MimeTypeService.fromFile(file);

		// check for mime type
		var primaryMime = mimeType.split('/')[0];
		if (primaryMime !== restrictMime) {
			return $modal.open({
				templateUrl: 'partials/modals/info.html',
				controller: 'InfoModalCtrl',
				resolve: {
					icon: function() { return 'fa-file-image-o'; },
					title: function() { return 'Image Upload'; },
					subtitle: function() { return 'Wrong file type!'; },
					message: function() { return 'Please upload a JPEG or PNG image.'; }
				}
			});
		}

		// $scope.mediaFile is where the progress stuff is stored, while $scope.game.mediaFile contains the result
		$scope.mediaFile[id] = {};

		// reset status
		if ($scope.game.mediaFile[id] && $scope.game.mediaFile[id].id) {
			FileResource.delete({ id : $scope.game.mediaFile[id].id });
			$scope.game.mediaFile[id] = {
				url: false,
				variations: {
					'medium-2x': { url: false }
				}
			};
			this.$emit('imageUnloaded');
		}

		// upload image
		var fileReader = new FileReader();
		fileReader.readAsArrayBuffer(file);
		fileReader.onload = function(event) {

			$scope.game.mediaFile[id] = { url: false };
			$scope.mediaFile[id].uploaded = false;
			$scope.mediaFile[id].uploading = true;
			$scope.mediaFile[id].status = 'Uploading file...';
			$upload.http({
				url: '/storage',
				method: 'POST',
				params: { type: type },
				headers: {
					'Content-Type': mimeType,
					'Content-Disposition': 'attachment; filename="' + file.name + '"'
				},
				data: event.target.result
			})
			.then(function(response) {
				$scope.mediaFile[id].uploading = false;
				$scope.mediaFile[id].status = 'Uploaded';

				var mediaResult = response.data;
				$scope.game.mediaFile[id].id = mediaResult.id;
				$scope.game.mediaFile[id].url = AuthService.setUrlParam(mediaResult.url, mediaResult.is_protected);
				$scope.game.mediaFile[id].variations = AuthService.setUrlParam(mediaResult.variations, mediaResult.is_protected);
				$scope.game.mediaFile[id].metadata = mediaResult.metadata;

				// run callback
				if (onSuccess) {
					onSuccess(response);
				}

			}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading image.', function() {
				$scope.mediaFile[id] = {};

			}), function (evt) {
				$scope.mediaFile[id].progress = parseInt(100.0 * evt.loaded / evt.total);
			});
		};
	};

	$scope.onBackglassUpload = function(response) {

		var bg = response.data;
		$scope.game._media.backglass = bg.id;

		var ar = Math.round(bg.metadata.size.width / bg.metadata.size.height * 1000) / 1000;
		var arDiff = Math.abs(ar / 1.25 - 1);

		$scope.backglass = {
			dimensions: bg.metadata.size.width + '×' + bg.metadata.size.height,
			test: ar === 1.25 ? 'optimal' : (arDiff < maxAspectRatioDifference ? 'warning' : 'error'),
			ar: ar,
			arDiff: Math.round(arDiff * 100)
		};
	};

	$scope.onLogoUpload = function(response) {
		var logo = response.data;
		$scope.game._media.logo = logo.id;
	};


	$scope.removeLink = function(link) {

	};


	$scope.searchOnIpdb = function() {
		$window.open(angular.element('#ipdbLink').attr('href'));
	};


	$scope.resetMedia();
	if ($localStorage.game) {
		$scope.game  = $localStorage.newGame;
	} else {
		$scope.resetGame();
	}
});