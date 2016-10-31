"use strict"; /* global ga, angular, _ */

/**
 * Home page of VPDB, i.e. the root index page.
 */
angular.module('vpdb.home', [])

	.controller('HomeController', function($scope, $rootScope, $http, $timeout, ApiHelper, GameResource, ReleaseResource, TrackerService) {

		$scope.theme('dark');
		$scope.setMenu('home');
		$scope.setTitle('VPDB - The Virtual Pinball Database');
		$scope.setDescription('VPDB is a platform around virtual pinball. It seeks to preserve the great pinball games from the last and current century in digital form, created by a wonderful community.')
		$scope.setKeywords('virtual pinball, database, pinball, vpinball, visual pinball, directb2s, backglass, beautiful, fast, open source');
		TrackerService.trackPage();

		$scope.searching = false;
		$scope.packs = [];
		$scope.newReleases = [];
		$scope.updatedReleases = [];
		$scope.feed = [];
		$scope.users = [];

		// stuff we need in the view
		$scope.Math = window.Math;

		if ($rootScope.loginParams.open) {
			$rootScope.loginParams.open = false;
			$rootScope.login();
		}

		$scope.searchResult = false;
		$scope.whatsThis = false;


		// QUERY LOGIC
		// --------------------------------------------------------------------

		var refresh = function(queryOverride) {

			if (!$scope.q) {
				$scope.searchResult = false;
			}

			// only fetch if a query
			if (!$scope.q || $scope.q.length < 3) {
				return;
			}

			var query = { };
			queryOverride = queryOverride || {};

			// search query
			if ($scope.q) {
				query.q = $scope.q;
			}

			query = _.extend(query, queryOverride);

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.searching = true;

				GameResource.query(query, ApiHelper.handlePagination($scope, function(games) {

					// only update results if result is different to avoid flicker.
					if (!_.isEqual(_.pluck($scope.games, 'id'), _.pluck(games, 'id'))) {
						$scope.games = games;
					}
					$scope.searchResult = true;
					$scope.searching = false;
				}));
				$scope.$query = query;
			} else {
				$scope.searchResult = true;
			}
		};

		$scope.paginate = function(link) {
			refresh(link.query);
		};
		$scope.$watch('q', refresh);

		// fetch latest releases
		$scope.releases = ReleaseResource.query({
			thumb_format: 'square' + $rootScope.pixelDensitySuffix,
			per_page: 6,
			sort: 'released_at' });

		// fetch latest releases
		$scope.popularGames = GameResource.query({
			per_page: 8,
			sort: 'popularity' });

	});

