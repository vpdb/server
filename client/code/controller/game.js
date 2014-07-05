ctrl.controller('GameController', function($scope, $http, $routeParams, $modal, $log) {

	$scope.theme('dark');
	$scope.setMenu('games');

	$scope.gameId = $routeParams.id;
	$scope.pageLoading = true;

	$scope.accordeon = {
		isFirstOpen: true
	};

	$http({
		method: 'GET',
		url: '/api-mock/games/' + $scope.gameId

	}).success(function(data, status, headers, config) {
		var game = data.result;
		game.lastrelease = new Date(game.lastrelease).getTime();

		$scope.game = game;
		setTimeout(function() {
			$('.image-link').magnificPopup({
				type: 'image',
				removalDelay: 300,
				mainClass: 'mfp-fade'
			});
		}, 0);
		$scope.pageLoading = false;
	});

	$scope.requestModPermission = function(release) {
		var modalInstance = $modal.open({
			templateUrl: 'partials/modals/requestModPermission',
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

ctrl.controller('AdminGameAddCtrl', function($scope, $upload, ApiHelper, IpdbResource, GameResource) {

	var maxAspectRatioDifference = 0.2;

	$scope.theme('light');
	$scope.setMenu('admin');

	$scope.game = {
		origin: 'recreation',
		media: {}
	};
	$scope.idValidated = false;

	$scope.refresh = function() {
		if (/id=\d+/i.test($scope.ipdbUrl)) {
			var m = $scope.ipdbUrl.match(/id=(\d+)/i);
			$scope.ipdbId = m[1];

		} else if (parseInt($scope.ipdbUrl)) {
			$scope.ipdbId = $scope.ipdbUrl;
		}

		if ($scope.ipdbId) {
			$scope.setLoading(true);
			var game = IpdbResource.get({ id: $scope.ipdbId }, function() {
				$scope.setLoading(false);

				$scope.game = _.extend($scope.game, game);
				if ($scope.game.short) {
					$scope.game.gameId = $scope.game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				} else {
					$scope.game.gameId = $scope.game.name.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				}
			}, ApiHelper.handleErrorsInDialog($scope, 'Error fetching data.'));
		} else {
			alert('Need either number or URL with ID!');
		}
	};

	$scope.check = function() {
		GameResource.head({ id: $scope.game.gameId }, function() {
			$scope.idValid = false;
			$scope.idValidated = true;
		}, function() {
			$scope.idValid = true;
			$scope.idValidated = true;
		})
	};

	$scope.submit = function() {
		$scope.game.gameType = $scope.game.gameType ? $scope.game.gameType.toLowerCase() : 'na';
		var result = GameResource.save($scope.game, function() {
			alert('success');
		}, ApiHelper.handleErrors($scope));
	};

	var onImageUpload = function(type, done) {
		return function($files) {
			var file = $files[0];
			var fileReader = new FileReader();
			fileReader.readAsArrayBuffer(file);
			fileReader.onload = function (e) {
				console.log(file);
				$upload.http({
					url: '/api/files',
					method: 'PUT',
					params: { type: type },
					headers: {
						'Content-Type': file.type,
						'Content-Disposition': 'attachment; filename="' + file.name + '"'
					},
					data: e.target.result
				}).then(done, ApiHelper.handleErrorsInDialog($scope, 'Error uploading image.'), function (evt) {
					$scope.progress = parseInt(100.0 * evt.loaded / evt.total);
					console.log('PROGRESS: ' + $scope.progress);
				});
			};
		};
	};

	$scope.onBackglassUpload = onImageUpload('backglass', function(response) {

		var bg = response.data;
		$scope.uploadedBackglass = bg.url;
		$scope.game.media.backglass = bg._id;

		var ar = Math.round(bg.metadata.size.width / bg.metadata.size.height * 1000) / 1000;
		var arDiff = Math.abs(ar / 1.25 - 1);

		$scope.backglass = {
			dimensions: bg.metadata.size.width + '×' + bg.metadata.size.height,
			test: ar == 1.25 ? 'optimal' : (arDiff < maxAspectRatioDifference ? 'warning' : 'error'),
			ar: ar,
			arDiff: Math.round(arDiff * 100)
		};
	});

	$scope.onLogoUpload = onImageUpload('logo', function(response) {

		var bg = response.data;
		$scope.uploadedLogo = bg.url;
		$scope.game.media.logo = bg._id;

	});


});