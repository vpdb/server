"use strict"; /* global ga, _ */

/**
 * Home page of VPDB, i.e. the root index page.
 */
angular.module('vpdb.home', [])

	.config(function($routeProvider, $locationProvider, $httpProvider) {
		// route
		$routeProvider.when('/', {
			templateUrl: 'home/home.html'
		});
	})

	.controller('HomeController', function($scope, $http) {

		$scope.theme('dark');
		$scope.setMenu('home');
		$scope.setTitle('Home');

		$scope.packs = [];
		$scope.newReleases = [];
		$scope.updatedReleases = [];
		$scope.feed = [];
		$scope.users = [];

		$http({
			method: 'GET',
			url: '/api-mock/packs'
		}).success(function(data, status, headers, config) {
			$scope.packs = data.result;
		});

		$http({
			method: 'GET',
			url: '/api-mock/releases?show=new'
		}).success(function(data, status, headers, config) {
			$scope.newReleases = data.result;
		});

		$http({
			method: 'GET',
			url: '/api-mock/releases?show=updated'
		}).success(function(data, status, headers, config) {
			$scope.updatedReleases = data.result;
		});

		$http({
			method: 'GET',
			url: '/api-mock/feed'
		}).success(function(data, status, headers, config) {
			$scope.feed = data.result;
		});

		$http({
			method: 'GET',
			url: '/api-mock/users'
		}).success(function(data, status, headers, config) {
			$scope.users = data.result;
		});

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
