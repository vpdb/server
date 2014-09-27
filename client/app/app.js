"use strict"; /* global ga, _ */

var deps = [
	'ngRoute',
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
	'sun.scrollable',
	'vpdb.controllers',
	'vpdb.filters',
	'vpdb.services',
	'vpdb.directives'
];

// Declare app level modules which depends on filters, and services
var app = angular.module('vpdb', deps);
var devsite = angular.module('devsite', [ 'ui.router' ].concat(deps));

/*
 * Configuration for the web application
 */
app.config(function($routeProvider, $locationProvider, $httpProvider) {

	$routeProvider.when('/',                        { templateUrl: 'partials/home.html' });
	$routeProvider.when('/games',                   { templateUrl: 'partials/games.html' });
	$routeProvider.when('/game/:id',                { templateUrl: 'partials/game.html' });
	$routeProvider.when('/game/:id/add-release',    { templateUrl: 'partials/member/release-add.html' });
	$routeProvider.when('/games/add',               { templateUrl: 'partials/admin/game-add.html' });
	$routeProvider.when('/admin/users',             { templateUrl: 'partials/admin/users.html' });
	$routeProvider.when('/auth/:strategy/callback', { templateUrl: 'partials/authenticating.html' });

	$routeProvider.otherwise({ templateUrl:'errors/404.html' });

	$locationProvider.html5Mode(true);
	$httpProvider.interceptors.push('AuthInterceptor');
});


/*
 * Configuration for the developer site
 */
devsite.config(function($stateProvider, $urlRouterProvider, $locationProvider) {

	$locationProvider.html5Mode(true);

	$stateProvider.state('home', {
		url: '/',
		templateUrl: 'partials/home.html'
	});

	$stateProvider.state('styleguide', {
		url: '/styleguide',
		templateUrl: 'partials/styleguide-main.html'
	});

	$stateProvider.state('styleguide.main', {
		url: '',
		templateUrl: function($stateParams) {
			console.log('matched main section');
			return 'partials/styleguide.html';
		}
	});

	$stateProvider.state('styleguide.section', {
		url: '/{section:[\\d\\.]+}',
		templateUrl: function($stateParams) {
			console.log('matched section %s', $stateParams.section);
			return 'partials/styleguide/' + $stateParams.section + '.html';
		}
	});

	// default routing
	$stateProvider.state('default', {
		url: '/{path:.*}',
		templateUrl: function($stateParams) {
			return 'partials/' + $stateParams.path + '.html';
		}
	});



/*	$routeProvider.when('/',       { templateUrl: 'partials/home.html' });
	$routeProvider.when('/:path',  { templateUrl: function(params) {
		return 'partials/' + params.path + '.html';
	}});

	$routeProvider.when('/styleguide/sections/:section', { templateUrl: function(route) {
		return '/styleguide/sections/' + route.section + '.html';
	}});

	$routeProvider.when('/styleguide',              { templateUrl: '/styleguide/overview.html' });

	$routeProvider.otherwise({ templateUrl:'errors/404.html' });*/

	//$urlRouterProvider.otherwise("/state1");
});


window.requestAnimFrame = (function() {
	return window.requestAnimationFrame    ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60);
		};
})();


(function(i,s,o,g,r,a,m)//noinspection JSHint
{//noinspection JSHint
	i['GoogleAnalyticsObject']=r;//noinspection JSHint
	i[r]=i[r]||function()//noinspection JSHint
	{
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();//noinspection JSHint
	a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-49887651-1', 'vpdb.ch');
///ga('send', 'pageview');
