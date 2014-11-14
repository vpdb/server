"use strict"; /* global ga, _ */

// TODO isolate namespace
// common deps
var deps = [
	'ngAnimate',
	'ngSanitize',
	'ngResource',
	'ngStorage',
	'ngDragDrop',
	'angularFileUpload',
	'angularMoment',
	'ui.bootstrap',
	'ui.gravatar',
	'angulartics',
	'angulartics.google.analytics',
	'monospaced.elastic',
	'sun.scrollable'
];

// main application modules
var appDeps = [
	'vpdb.auth',
	'vpdb.login',
	'vpdb.home',
	'vpdb.commons',
	'vpdb.games.list',
	'vpdb.games.details',
	'vpdb.games.add',
	'vpdb.releases.add',
	'vpdb.users.list',
	'vpdb.users.edit'
];

var common = angular.module('vpdb.commons', []);

/**
 * The VPDB main application.
 */
angular.module('vpdb',  [ 'ngRoute' ].concat(deps).concat(appDeps))

	.config(function($routeProvider, $locationProvider) {

		// routes
		$routeProvider.when('/',                        { templateUrl: '/home/home.html' });
		$routeProvider.when('/games',                   { templateUrl: '/games/list.html' });
		$routeProvider.when('/game/:id',                { templateUrl: '/games/details.html' });
		$routeProvider.when('/games/add',               { templateUrl: '/games/add.html' });
		$routeProvider.when('/game/:id/add-release',    { templateUrl: '/releases/add.html' });
		$routeProvider.when('/admin/users',             { templateUrl: '/users/list.html' });
		$routeProvider.when('/auth/:strategy/callback', { templateUrl: '/auth/authenticating.html' });

		$routeProvider.otherwise({ templateUrl: 'errors/404.html' });
		$locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
	})

	.config(['msdElasticConfig', function(config) {
		config.append = '\n\n';
	}]);

/**
 * The developer site
 */
angular.module('devsite', [ 'ui.router' ].concat(deps).concat(appDeps).concat([ 'duScroll', 'vpdb.devsite' ]))

	.config(function($locationProvider) {
		$locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
	});


// http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function() {
	return window.requestAnimationFrame    ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60);
		};
})();

