'use strict';

// Declare app level module which depends on filters, and services

angular.module('vpdb', [
	'ngRoute',
	'ui.bootstrap',
	'vpdb.controllers',
	'vpdb.filters',
	'vpdb.services',
	'vpdb.directives'

]).config(function($routeProvider, $locationProvider) {

	$routeProvider.
		when('/tables', {
			templateUrl: 'partials/tables'
		}).

		when('/view2', {
			templateUrl: 'partials/partial2',
			controller: 'MyCtrl2'
		}).

		otherwise({
			redirectTo: '/tables'
		});

	$locationProvider.html5Mode(true);
});
