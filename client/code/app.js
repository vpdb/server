"use strict"; /*global ga, _*/

// Declare app level module which depends on filters, and services
var app = angular.module('vpdb', [
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
	'sun.scrollable',
	'vpdb.controllers',
	'vpdb.filters',
	'vpdb.services',
	'vpdb.directives'
]);

app.config(function($routeProvider, $locationProvider, $httpProvider) {

	$routeProvider.when('/', { templateUrl: 'partials/home.html' });
	$routeProvider.when('/games', { templateUrl: 'partials/games.html' });
	$routeProvider.when('/game/:id', { templateUrl: 'partials/game.html' });
	$routeProvider.when('/game/:id/add-release', { templateUrl: 'partials/member/release-add.html' });
	$routeProvider.when('/games/add', { templateUrl: 'partials/admin/game-add.html' });
	$routeProvider.when('/admin/users', { templateUrl: 'partials/admin/users.html' });
	$routeProvider.when('/styleguide', { templateUrl: '/styleguide/overview.html' });
	$routeProvider.when('/styleguide/sections/:section', { templateUrl: function(route) {
		return '/styleguide/sections/' + route.section + '.html';
	}});
	$routeProvider.when('/auth/:strategy/callback', { templateUrl: 'partials/authenticating.html' });

	$routeProvider.otherwise({templateUrl:'errors/404.html'});

	$locationProvider.html5Mode(true);
	$httpProvider.interceptors.push('AuthInterceptor');
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
