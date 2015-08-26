"use strict"; /* global ga, _ */

/**
 * Home page of VPDB, i.e. the root index page.
 */
angular.module('vpdb.home', [])

	.controller('HomeController', function($scope, $rootScope, $http, $timeout, ApiHelper, GameResource, ReleaseResource) {

		$scope.theme('dark');
		$scope.setMenu('home');
		$scope.setTitle('Home');

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
			per_page: 12,
			sort: 'modified_at' });

		// fetch latest releases
		$scope.games = GameResource.query({
			per_page: 12,
			sort: 'popularity' });

	})

	.filter('manufacturerIcon', function() {
		return function(item) {
			switch (item.logo) {
				case 'williams':
					return 'icon-williams';
				case 'stern':
					return 'icon-stern';
				default:
					return '';
			}
		};
	})

	.filter('feedIcon', function() {
		return function(item) {
			switch (item.type) {
				case 'comment':
					return 'fa-comment';
				case 'release':
					return 'fa-arrow-circle-up';
				default:
					return '';
			}
		};
	})

	.filter('smalls', function() {
		return function(str) {
			return str.replace(/(\d\d\d0)s/i, "$1<small>s</small>");
		};
	})

	.filter('feedAction', function() {
		return function(item) {

			switch (item.type) {
				case 'comment':
					return '&nbsp;commented on <a href="/game/' + item.data.game.id + '#' + item.data.release.id +'" class="a--lighter">' +
						item.data.release.title +
						'</a> of <a href="/game/' + item.data.game.id +'" class="a--lighter">' +
						item.data.game.name +
						'</a>';

				case 'release':
					return '&nbsp;released <a href="/game/' + item.data.game.id + '#' + item.data.release.id +'" class="a--lighter">' +
						item.data.release.title +
						'</a> <label class="label--version">' + item.data.release.lastversion.version + '</label>' +
						' of ' +
						'<a href="/game/' + item.data.game.id +'" class="a--lighter">' +
						item.data.game.name +
						'</a>';
				default:
					return '<i>Unknown event</i>';
			}
		};
	})

	.filter('feedMessage', function() {
		return function(item) {
			switch (item.type) {
				case 'comment':
					return item.data.message;

				case 'release':
					return 'Changelog here';
				default:
					return '<i>Unknown event</i>';
			}
		};
	});
