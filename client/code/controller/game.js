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

ctrl.controller('AdminGameAddCtrl', function($scope, $upload, ApiHelper, IpdbResource) {

	$scope.theme('light');
	$scope.setMenu('admin');

	$scope.game = {};

	$scope.refresh = function() {
		var ipdbId;
		if (/id=\d+/i.test($scope.ipdbUrl)) {
			var m = $scope.ipdbUrl.match(/id=(\d+)/i);
			ipdbId = m[1];

		} else if (parseInt($scope.ipdbUrl)) {
			ipdbId = $scope.ipdbUrl;
		}

		if (ipdbId) {
			$scope.setLoading(true);
			$scope.game = IpdbResource.get({ id: ipdbId }, function() {
				$scope.setLoading(false);

				if ($scope.game.short) {
					$scope.gameId = $scope.game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				} else {
					$scope.gameId = $scope.game.name.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
				}
			}, ApiHelper.handleErrorsInDialog($scope, 'Error fetching data.'));
		} else {
			alert('Need either number or URL with ID!');
		}
	};

	$scope.onFileSelect = function($files) {
		//$files: an array of files selected, each file has name, size, and type.
		var file = $files[0];

		var fileReader = new FileReader();
		fileReader.readAsArrayBuffer(file);
		fileReader.onload = function(e) {
			console.log(file);
			$upload.http({
				url: '/api/files',
				method: 'PUT',
				params: { type: 'backglass' },
				headers: {
					'Content-Type': file.type,
					'Content-Disposition': 'attachment; filename="' + file.name + '"'
				},
				data: e.target.result
			}).then(function(response) {
				console.log('SUCCESS:');
				$scope.uploadedLink = response.data.url;
				console.log(response);

			}, function(err) {
				console.log('ERROR: ' + err);
			}, function(evt) {
				$scope.progress = parseInt(100.0 * evt.loaded / evt.total);
				console.log('PROGRESS: ' + $scope.progress);
			});
		};

	};

});