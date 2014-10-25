"use strict"; /* global _*/

angular.module('vpdb.games.list', [])

	.controller('GameListController', function($scope, $rootScope, $http, $location, $templateCache, $route, ApiHelper, GameResource) {

		$scope.theme('dark');
		$scope.setTitle('Games');
		$scope.setMenu('games');

		$scope.$query = null;
		$scope.filterDecades = [];
		$scope.filterManufacturer = [];
		$scope.sort = 'title';

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


		// QUERY LOGIC
		// --------------------------------------------------------------------

		var refresh = function(queryOverride) {
			var query = { sort: $scope.sort };
			queryOverride = queryOverride || {};

			// search query
			if ($scope.q && $scope.q.length > 2) {
				query.q = $scope.q;
			}
			if (!$scope.q) {
				delete query.q;
			}

			// filter by decade
			if ($scope.filterDecades.length) {
				query.decade = $scope.filterDecades.join(',');
			} else {
				delete query.decade;
			}

			// filter by manufacturer
			if ($scope.filterManufacturer.length) {
				query.mfg = $scope.filterManufacturer.join(',');
			} else {
				delete query.mfg;
			}
			query = _.extend(query, queryOverride);

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.games = GameResource.query(query, ApiHelper.handlePagination($scope));
				$scope.$query = query;
			}
		};

		$scope.$watch('q', refresh);

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('dataChangeSort', function(event, field, direction) {
			$scope.sort = (direction === 'desc' ? '-' : '') + field;
			refresh();
		});

		$scope.$on('dataToggleDecade', function(event, decade) {
			if (_.contains($scope.filterDecades, decade)) {
				$scope.filterDecades.splice($scope.filterDecades.indexOf(decade), 1);
			} else {
				$scope.filterDecades.push(decade);
			}
			refresh();
		});

		$scope.$on('dataToggleManufacturer', function(event, manufacturer) {
			if (_.contains($scope.filterManufacturer, manufacturer)) {
				$scope.filterManufacturer.splice($scope.filterManufacturer.indexOf(manufacturer), 1);
			} else {
				$scope.filterManufacturer.push(manufacturer);
			}
			refresh();
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

	.directive('filterDecade', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.click(function() {
					element.toggleClass('active');
					scope.$emit('dataToggleDecade', parseInt(attrs.filterDecade), element.hasClass('active'));
				});
			}
		};
	})

	.directive('filterManufacturer', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.click(function() {
					element.toggleClass('active');
					scope.$emit('dataToggleManufacturer', attrs.filterManufacturer, element.hasClass('active'));
				});
			}
		};
	})

	.directive('sort', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.click(function() {
					if (element.hasClass('selected')) {
						element.toggleClass('asc');
						element.toggleClass('desc');
					} else {
						element.siblings().removeClass('selected');
						element.addClass('selected');
						element.addClass('asc');
						if (attrs.d === 'asc') {
							element.addClass('asc');
							element.removeClass('desc');
						} else {
							element.removeClass('asc');
							element.addClass('desc');
						}
					}
					scope.$emit('dataChangeSort', attrs.sort, element.hasClass('asc') ? 'asc' : 'desc');
				});
			}
		};
	});
