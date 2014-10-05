"use strict"; /* global _ */

angular.module('vpdb.devsite', [])

	.config(function($stateProvider, $urlRouterProvider, $locationProvider) {

		$locationProvider.html5Mode(true);

		// home page
		$stateProvider.state('home', {
			url: '/',
			templateUrl: 'html/home.html'
		});

		// style guide
		$stateProvider.state('styleguide', {
			abstract: true,
			url: '/styleguide',
			templateUrl: 'html/styleguide-main.html'
		});
		$stateProvider.state('styleguide.index', {
			url: '',
			templateUrl: 'html/styleguide.html'
		});
		$stateProvider.state('styleguide.section', {
			url: '/{section:[\\d\\.]+}',
			templateUrl: function($stateParams) {
				return 'html/styleguide/' + $stateParams.section + '.html';
			}
		});

		// api doc
		$stateProvider.state('api', {
			abstract: true,
			url: '/api',
			templateUrl: 'html/api/menu.html'
		});
		$stateProvider.state('api.index', {
			url: '',
			templateUrl: 'html/api/index.html'
		});
		$stateProvider.state('api.reference', {
			url: '/reference/{ref}',
			templateUrl: function($stateParams) {
				return 'html/api/reference/' + $stateParams.ref + '.html';
			}
		});
		$stateProvider.state('api.section', {
			url: '/{path:.*}',
			templateUrl: function($stateParams) {
				return 'html/api/' + $stateParams.path + '.html';
			}
		});

		// static doc
		$stateProvider.state('doc', {
			abstract: true,
			url: '/{section}',
			templateUrl: function($stateParams) {
				return 'html/' + $stateParams.section + '/menu.html';
			}
		});
		$stateProvider.state('doc.index', {
			url: '',
			templateUrl: function($stateParams) {
				return 'html/' + $stateParams.section + '/index.html';
			}
		});
		$stateProvider.state('doc.section', {
			url: '/{path:.*}',
			templateUrl: function($stateParams) {
				return 'html/' + $stateParams.section + '/' + $stateParams.path + '.html';
			}
		});

		// default routing
		$stateProvider.state('default', {
			url: '/{path:.*}',
			templateUrl: function($stateParams) {
				return 'html/' + $stateParams.path + '.html';
			}
		});

		// TODO $urlRouterProvider.otherwise(..)
	})

	.controller('MethodCollapseCtrl', function($document, $element, $scope, $rootScope, $location, $timeout) {

		$scope.isCollapsed = true;

		var updateCollapseState = function() {
			var method, parent, hash = $location.hash();
			if (!hash) {
				return;
			}
			if (!$scope.resource) {
				return;
			}
			if (~hash.indexOf('.')) {
				method = hash.substr(0, hash.indexOf('.'));
				parent = hash.substr(hash.indexOf('.')).replace(/\./g, '/');
			} else {
				method = hash;
				parent = '';
			}
			if ($scope.resource.method === method && $scope.resource.parentUrl === parent) {
				$scope.isCollapsed = false;
				// wait until stuff is extended before scrolling
				$timeout(function() {
					$document.scrollToElement($element, 55, 200);
				}, 250);
			} else {
				$scope.isCollapsed = true;
			}
		}

		$scope.$watch('resource', updateCollapseState);
		$rootScope.$on('$locationChangeSuccess', updateCollapseState);
	});
