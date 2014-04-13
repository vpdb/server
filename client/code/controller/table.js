ctrl.controller('TableController', function($scope, $http, $routeParams, $modal, $log) {

	$scope.tableId = $routeParams.id;
	$scope.pageLoading = true;

	$http({
		method: 'GET',
		url: '/api/tables/' + $scope.tableId

	}).success(function(data, status, headers, config) {
		var table = data.result;
		table.lastrelease = new Date(table.lastrelease).getTime();

		$scope.table = table;
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