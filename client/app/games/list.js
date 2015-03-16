"use strict"; /* global _*/

angular.module('vpdb.games.list', [])

	.controller('GameListController', function($scope, $rootScope, $http, $location, $templateCache, ApiHelper, GameResource) {

		$scope.theme('dark');
		$scope.setTitle('Games');
		$scope.setMenu('games');

		$scope.$query = null;
		$scope.filterDecades = [];
		$scope.filterManufacturer = [];
		$scope.sort = 'title';
		$scope.firstQuery = true;

		// stuff we need in the view
		$scope.Math = window.Math;

		// preload partials
		_.each(['compact', 'extended', 'table'], function(view) {
			$http.get('/games/list-' + view + '.html', { cache:$templateCache });
		});

		// todo use ui-router for this
		var hash = $location.hash();
		$scope.viewtype = _.contains([ 'extended', 'table' ], hash) ? hash : 'compact';
		$scope.setViewTemplate = function() {
			$scope.template = '/games/list-' + $scope.viewtype + '.html';
		};
		$scope.switchview = function(view) {
			if ($scope.viewtype === view) {
				return;
			}
			$location.hash(view);
			$scope.viewtype = view;
			$scope.setViewTemplate();
		};
		$scope.setViewTemplate();
		var urlQuery = $location.search();


		// QUERY LOGIC
		// --------------------------------------------------------------------
		var refresh = function(queryOverride, firstRunCheck) {

			// ignore initial watches
			if (queryOverride === firstRunCheck) {
				return;
			}

			var query = { sort: $scope.sort };
			if ($scope.firstQuery) {
				query.page = urlQuery.page;
				$scope.firstQuery = false;
			}
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

			// filter empty games
			if (!$scope.includeEmptyGames) {
				query.min_releases = 1;
			}

			query = _.extend(query, queryOverride);
			$location.search(queryToUrl(query));

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.games = GameResource.query(query, ApiHelper.handlePagination($scope));
				$scope.$query = query;
			}
		};

		var queryToUrl = function(query) {
			var defaults = {
				sort: 'title',
				page: '1',
				per_page: '12'
			};
			var q = _.omit(query, function(value, key) {
				return defaults[key] === value;
			});
			if (query.min_releases) {
				delete q.min_releases;
			} else {
				q.show_empty = 1;
			}
			return q;
		};

		// update scope with query variables TODO surely we can refactor this a bit?
		if (urlQuery.q) {
			$scope.q = urlQuery.q;
		}
		if (urlQuery.show_empty) {
			$scope.includeEmptyGames = true;
		}
		if (urlQuery.page) {
			$scope.page = urlQuery.page;
		}
		if (urlQuery.sort) {
			$scope.sort = urlQuery.sort;
		}
		if (urlQuery.decade) {
			$scope.filterYearOpen = true;
			$scope.filterDecades = _.map(urlQuery.decade.split(','), function(y) {
				return parseInt(y);
			});
		}
		if (urlQuery.mfg) {
			$scope.filterManufacturerOpen = true;
			$scope.filterManufacturer = urlQuery.mfg.split(',');
		}


		$scope.$watch('q', refresh);
		$scope.$watch('includeEmptyGames', refresh);

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('dataChangeSort', function(event, field, direction) {
			$scope.sort = (direction === 'desc' ? '-' : '') + field;
			refresh({});
		});

		$scope.$on('dataToggleDecade', function(event, decade) {
			if (_.contains($scope.filterDecades, decade)) {
				$scope.filterDecades.splice($scope.filterDecades.indexOf(decade), 1);
			} else {
				$scope.filterDecades.push(decade);
			}
			refresh({});
		});

		$scope.$on('dataToggleManufacturer', function(event, manufacturer) {
			if (_.contains($scope.filterManufacturer, manufacturer)) {
				$scope.filterManufacturer.splice($scope.filterManufacturer.indexOf(manufacturer), 1);
			} else {
				$scope.filterManufacturer.push(manufacturer);
			}
			refresh({});
		});

		// trigger first load
		refresh({});
	})

	.directive('filterDecade', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				if (_.contains(scope.filterDecades, parseInt(attrs.filterDecade))) {
					element.addClass('active');
				}
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
				if (_.contains(scope.filterManufacturer, attrs.filterManufacturer)) {
					element.addClass('active');
				}
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
				var currentSort = scope.sort[0] === '-' ? scope.sort.substr(1) : scope.sort;
				if (currentSort === attrs.sort) {
					element.addClass('selected');
				}
				if (scope.sort[0] === '-') {
					element.removeClass('asc');
					element.addClass('desc');
				} else {
					element.addClass('asc');
					element.removeClass('desc');
				}
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
