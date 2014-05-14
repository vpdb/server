ctrl.controller('GameListController', function($scope, $http, $location, $templateCache, $route) {

	$scope.filterDecades = [];
	$scope.filterManufacturer = [];
	$scope.sort = 'name';
	$scope.sortReverse = false;

	$scope.setMenu('games');

	// preload partials
	_.each(['compact', 'extended', 'list'], function(view) {
		$http.get( '/partials/game-' + view, { cache:$templateCache });
	});

	var hash = $location.hash();
	$scope.viewtype = _.contains([ 'extended', 'list' ], hash) ? hash : 'compact';
	$scope.setView = function() {
		$scope.template = '/partials/game-' + $scope.viewtype;
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

	$http({
		method: 'GET',
		url: '/api-mock/games'

	}).success(function(data, status, headers, config) {
		_.each(data.result, function(game) {
			game.art = {
				backglass: 'backglass/' + game.key + '.png',
				backglass_thumb: 'backglass/thumb/' + game.key + '.png'
			}
		});
		$scope.games = data.result;
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
