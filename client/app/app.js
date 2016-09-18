"use strict"; /* global ga, _, angular */

// TODO isolate namespace
// common deps
var deps = [
	'ngAnimate',
	'ngSanitize',
	'ngResource',
	'ngStorage',
	'ngDragDrop',
	'ngClipboard',
	'ngFileUpload',
	'angularMoment',
	'ui.router',
	'ui.bootstrap',
	'ui.gravatar',
	'angulartics',
	'angulartics.google.analytics',
	'monospaced.elastic',
	'sun.scrollable',
	'growlNotifications',
	'mentio'
];

// main application modules
var appDeps = [
	'vpdb.auth',
	'vpdb.backglasses.add',
	'vpdb.common',
	'vpdb.login',
	'vpdb.home',
	'vpdb.animations',
	'vpdb.modal',
	'vpdb.rating',
	'vpdb.games.list',
	'vpdb.games.details',
	'vpdb.games.add',
	'vpdb.games.edit',
	'vpdb.profile.settings',
	'vpdb.profile.downloads',
	'vpdb.profile.notifications',
	'vpdb.profile.stats',
	'vpdb.release',
	'vpdb.releases.add',
	'vpdb.releases.list',
	'vpdb.releases.details',
	'vpdb.releases.edit',
	'vpdb.uploads.list',
	'vpdb.users.list',
	'vpdb.users.edit'
];

/**
 * Make angular.module return registered module instead of erasing, so we can
 * have a module in multiple files
 */
(function(angular) {
	var origMethod = angular.module;

	var alreadyRegistered = {};

	/**
	 * Register/fetch a module.
	 *
	 * @param {string} name module name.
	 * @param {array} reqs list of modules this module depends upon.
	 * @param {function} configFn config function to run when module loads (only applied for the first call to create this module).
	 * @returns {*} the created/existing module.
	 */
	angular.module = function(name, reqs, configFn) {
		reqs = reqs || [];
		var module = null;

		if (alreadyRegistered[name]) {
			module = origMethod(name);
			module.requires.push.apply(module.requires, reqs);
		} else {
			module = origMethod(name, reqs, configFn);
			alreadyRegistered[name] = module;
		}

		return module;
	};
})(angular);

/**
 * The VPDB main application.
 */
angular.module('vpdb', deps.concat(appDeps))

	.config(function($stateProvider, $urlRouterProvider, $locationProvider) {

		// routes
		$stateProvider.state('home',             { url: '/',                             templateUrl: '/home/home.html', controller: 'HomeController' });
		$stateProvider.state('games',            { url: '/games',                        templateUrl: '/games/list.html' });
		$stateProvider.state('gameDetails',      { url: '/games/:id',                    templateUrl: '/games/details.html' });
		$stateProvider.state('editGame',         { url: '/games/:id/edit',               templateUrl: '/games/edit.html' });
		$stateProvider.state('releases',         { url: '/releases',                     templateUrl: '/releases/list.html' });
		$stateProvider.state('addGame',          { url: '/add-game',                     templateUrl: '/games/add.html' });
		$stateProvider.state('addRelease',       { url: '/games/:id/add-release',        templateUrl: '/releases/add-release.html' });
		$stateProvider.state('addBackglass',     { url: '/games/:id/add-backglass',      templateUrl: '/backglasses/add.html' });
		$stateProvider.state('addReleaseVersion',{ url: '/games/:id/releases/:releaseId/add',  templateUrl: '/releases/add-version.html' });
		$stateProvider.state('releaseDetails',   { url: '/games/:id/releases/:releaseId',      templateUrl: '/releases/details.html' });
		$stateProvider.state('editRelease',      { url: '/games/:id/releases/:releaseId/edit', templateUrl: '/releases/edit.html' });
		$stateProvider.state('adminUsers',       { url: '/admin/users',                  templateUrl: '/users/list.html' });
		$stateProvider.state('adminUploads',     { url: '/admin/uploads',                templateUrl: '/uploads/list.html' });
		$stateProvider.state('profile',          { url: '/profile',                      templateUrl: '/profile/profile.html' });
		$stateProvider.state('profile.settings',         { url: '/settings',             templateUrl: '/profile/settings.html', controller: 'ProfileSettingsCtrl' });
		$stateProvider.state('profile.downloads',        { url: '/downloads',            templateUrl: '/profile/downloads.html', controller: 'ProfileDownloadsCtrl' });
		$stateProvider.state('profile.notifications',    { url: '/notifications',        templateUrl: '/profile/notifications.html', controller: 'ProfileNotificationsCtrl' });
		$stateProvider.state('profile.stats',            { url: '/stats',                templateUrl: '/profile/stats.html', controller: 'ProfileStatsCtrl' });
		$stateProvider.state('authCallback',     { url: '/auth/:strategy/callback?code', templateUrl: '/auth/authenticating.html' });
		$stateProvider.state('confirmToken',     { url: '/confirm/:token',               templateUrl: '/auth/confirm.html' });
		$stateProvider.state('404',              {                                       templateUrl: '/errors/404.html' });

		$locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});

		$urlRouterProvider.otherwise(function($injector, $location){
			var state = $injector.get('$state');
			state.go('404');
			return $location.path();
		});
	})

	.config(['msdElasticConfig', function(config) {
		config.append = '\n\n';
	}])

	.config(['ngClipProvider', function(ngClipProvider) {
		ngClipProvider.setPath("/public/ZeroClipboard.swf");
	}]);

/**
 * The developer site
 */
angular.module('devsite', deps.concat(appDeps).concat([ 'duScroll', 'vpdb.devsite' ]))

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


