"use strict"; /* global _*/

angular.module('vpdb.games.list', [])

	.controller('GameListController', function($scope, $rootScope, $http, $location, $templateCache, $route, GameResource) {

		$scope.theme('dark');
		$scope.setTitle('Games');
		$scope.setMenu('games');

		$scope.filterDecades = [];
		$scope.filterManufacturer = [];
		$scope.sort = 'name';

		$scope.sortReverse = false;

		// preload partials
		_.each(['compact', 'extended', 'table'], function(view) {
			$http.get('/games/list-' + view + '.html', { cache:$templateCache });
		});

		// todo use ui-router for this
		var hash = $location.hash();
		$scope.viewtype = _.contains([ 'extended', 'table' ], hash) ? hash : 'compact';
		$scope.setView = function() {
			$scope.template = '/games/list-' + $scope.viewtype + '.html';
		};
		$scope.switchview = function(view) {
			if ($scope.viewtype === view) {
				return;
			}
			$location.hash(view);
			$scope.viewtype = view;
			$scope.setView();
		};
		$scope.setView();


		$scope.games = GameResource.query();

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
			$scope.sortReverse = direction === 'desc';
			$scope.$apply();
		});

		// don't relead
		var lastRoute = $route.current;
		var lastPath = $location.path();
		$scope.$on('$locationChangeSuccess', function() {
			// "undo" route change if path didn't change (only hashes or params)
			if ($location.path() === lastPath) {
				$route.current = lastRoute;
			}
		});
	})

	.filter('decade', function() {
		return function(items, decades) {
			if (!items || !decades || !decades.length) {
				return items;
			}
			return _.filter(items, function(game) {
				var decade;
				for (var i = 0; i < decades.length; i++) {
					decade = decades[i];
					if (game.year >= decade && game.year < (decade + 10)) {
						return true;
					}
				}
				return false;
			});
		};
	})

	.filter('manufacturer', function() {
		return function(items, manufacturers) {
			if (!items || !manufacturers || !manufacturers.length) {
				return items;
			}
			return _.filter(items, function(game) {
				var manufacturer;
				for (var i = 0; i < manufacturers.length; i++) {
					manufacturer = manufacturers[i];
					if (game.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
						return true;
					}
				}
				return false;
			});
		};
	});