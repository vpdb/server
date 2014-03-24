ctrl.controller('TableListController', function($scope, $http, $location, $templateCache) {

	// preload partials
	_.each(['compact', 'extended', 'list'], function(view) {
		$http.get( '/partials/table-' + view, { cache:$templateCache });
	});

	var hash = $location.hash();
	if (hash == 'extended') {
		$scope.viewtype = 'extended';
	} else if (hash == 'list') {
		$scope.viewtype = 'list';
	} else {
		$scope.viewtype = 'compact'
	}
	$scope.template = '/partials/table-' + $scope.viewtype;

	$scope.switchview = function(view) {
		if ($scope.viewtype == view) {
			return;
		}
		$location.hash(view);
	};

	$scope.details = function(key) {
		$location.hash('');
		$location.path('/table/' + key);
	};

	$http({
		method: 'GET',
		url: '/api/tables'

	}).success(function(data, status, headers, config) {
		_.each(data.result, function(table) {
			table.art = {
				backglass: 'backglass/' + table.key + '.png',
				backglass_thumb: 'backglass/thumb/' + table.key + '.png'
			}
		});
		$scope.tables = data.result;
	});
});
