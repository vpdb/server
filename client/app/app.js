"use strict"; /* global ga, _ */

// common deps
var deps = [
	'ngAnimate',
	'ngSanitize',
	'ngResource',
	'ngStorage',
	'ngDragDrop',
	'angularFileUpload',
	'ui.bootstrap',
	'angulartics',
	'angulartics.google.analytics',
	'monospaced.elastic',
	'sun.scrollable'
];

// main application
var appDeps = [
	'vpdb.auth',
	'vpdb.home',
	'vpdb.games.list',
	'vpdb.games.details',
	'vpdb.games.add',
	'vpdb.releases.add',
	'vpdb.users.list',
	'vpdb.users.edit'
];

/**
 * The VPDB main application.
 */
var app = angular.module('vpdb',  [ 'ngRoute' ].concat(deps).concat(appDeps))

	.config(function($routeProvider, $locationProvider) {

		$routeProvider.otherwise({ templateUrl: 'errors/404.html' });
		$locationProvider.html5Mode(true);
	});


/**
 * The developer site
 */
angular.module('devsite', [ 'ui.router' ].concat(deps).concat([ 'duScroll', 'vpdb.devsite' ]))

	.config(function($routeProvider, $locationProvider) {

		$routeProvider.otherwise({ templateUrl: 'errors/404.html' });
		$locationProvider.html5Mode(true);
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

