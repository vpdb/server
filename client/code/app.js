'use strict';

// Declare app level module which depends on filters, and services

var app = angular.module('vpdb', [
	'ngRoute',
	'ngAnimate',
	'ngSanitize',
	'ui.bootstrap',
	'vpdb.controllers',
	'vpdb.filters',
	'vpdb.services',
	'vpdb.directives'
]);

app.config(function($routeProvider, $locationProvider) {

	$routeProvider.
		when('/tables', {
			templateUrl: 'partials/tables'
		}).

		when('/table/:id', {
			templateUrl: 'partials/table'
		}).

		otherwise({
			redirectTo: '/tables'
		});

	$locationProvider.html5Mode(true);

});

window.requestAnimFrame = (function() {
	return window.requestAnimationFrame    ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60);
		};
})();