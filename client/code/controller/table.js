ctrl.controller('TableController', function($scope, $http, $routeParams, $modal, $log) {

	$scope.tableId = $routeParams.id;

	$http({
		method: 'GET',
		url: '/api/table/' + $scope.tableId

	}).success(function(data, status, headers, config) {
		var table = data.result;
		table.lastrelease = new Date(table.lastrelease).getTime();

		$scope.table = table;
		setTimeout(function() {
			$('.image-link').magnificPopup({
				type: 'image',
				removalDelay: 300,
				mainClass: 'mfp-with-zoom',
				zoom: {
					enabled: true,

					duration: 300, // duration of the effect, in milliseconds
					easing: 'ease-in-out', // CSS transition easing function

					// The "opener" function should return the element from which popup will be zoomed in
					// and to which popup will be scaled down
					opener: function(openerElement) {
						// openerElement is the element on which popup was initialized, in this case its <a> tag
						// you don't need to add "opener" option if this code matches your needs, it's defailt one.
						return openerElement.is('.img-wrapper') ? openerElement : openerElement.find('.img-wrapper');
					}
				}
			});
		}, 0);

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