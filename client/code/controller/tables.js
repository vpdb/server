ctrl.controller('TableListController', function($scope, $http, $location, $templateCache, $route) {

	$scope.filterDecades = [];
	$scope.filterManufacturer = [];
	$scope.sort = 'name';
	$scope.sortReverse = false;

	// preload partials
	_.each(['compact', 'extended', 'list'], function(view) {
		$http.get( '/partials/table-' + view, { cache:$templateCache });
	});

	var hash = $location.hash();
	$scope.viewtype = _.contains([ 'extended', 'list' ], hash) ? hash : 'compact';
	$scope.setView = function() {
		$scope.template = '/partials/table-' + $scope.viewtype;
	};
	$scope.switchview = function(view) {
		if ($scope.viewtype == view) {
			return;
		}
		$location.hash(view);
		$scope.viewtype = view;
		$scope.setView();
	};
	$scope.setView();

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

	$scope.$on('dataToggleDecade', function(event, decade) {
		if (_.contains($scope.filterDecades, decade)) {
			$scope.filterDecades.splice($scope.filterDecades.indexOf(decade), 1);
		} else {
			$scope.filterDecades.push(decade);
		}
		$scope.$apply();
	});

	$scope.$on('dataToggleManufacturer', function(event, manufacturer) {
		if (_.contains($scope.filterManufacturer, manufacturer)) {
			$scope.filterManufacturer.splice($scope.filterManufacturer.indexOf(manufacturer), 1);
		} else {
			$scope.filterManufacturer.push(manufacturer);
		}
		$scope.$apply();
	});

	$scope.$on('dataChangeSort', function(event, field, direction) {
		$scope.sort = field;
		$scope.sortReverse = direction == 'desc';
		$scope.$apply();
	});

	// don't relead
	var lastRoute = $route.current;
	var lastPath = $location.path();
	$scope.$on('$locationChangeSuccess', function() {
		// "undo" route change if path didn't change (only hashes or params)
		if ($location.path() == lastPath) {
			$route.current = lastRoute;
		}
	});
});
