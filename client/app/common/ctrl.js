"use strict"; /* global angular, _ */

angular.module('vpdb.common', [])

	.controller('AppCtrl', function($scope, $rootScope, $state, $location, $modal, $localStorage, $timeout,
									AuthService, ProfileService, ModalService, ModalFlashService, DownloadService, UserResource) {

		$rootScope.themeName = 'theme-dark';

		$rootScope.auth = AuthService;
		$rootScope.$storage = $localStorage;
		$rootScope.currentUrl = $location.path();
		$rootScope.loginParams = {
			open: false,
			localOnly: false
		};
		$rootScope.errorFlash = null;
		$rootScope.icon = function(icon) {
			return '#icon-' + icon;
		};

		$scope.menu = 'home';
		$scope.downloadsPinned = false;
		$scope.pinnedDownloads = {};
		$scope.pinnedDownloadCount = 0;
		$scope.pinnedDownloadSize = 0;
		$scope.loading = false;
		$scope.notifications = {};

		AuthService.init();
		ProfileService.init();


		// on every page
		$rootScope.$on('$stateChangeStart', function(event, toState) {
			$rootScope.state = toState;
		});
		$rootScope.$on('$stateChangeSuccess', function() {
			ModalFlashService.process();
		});

		$scope.navGame = function(key) {
			$state.go('gameDetails', { id: key });
		};

		$scope.setTitle = function(title) {
			$scope.pageTitle = title;
		};

		$scope.setMenu = function(menu) {
			$scope.menu = menu;
		};

		$scope.theme = function(theme) {
			$rootScope.themeName = 'theme-' + theme;
		};

		$scope.toggleTheme = function() {
			$rootScope.themeName = $rootScope.themeName === 'theme-dark' ? 'theme-light' : 'theme-dark';
		};

		$scope.setLoading = function(loading) {
			$scope.loading = loading;
		};

		$rootScope.downloadFile = function(file) {
			DownloadService.downloadFile(file);
		};
		$rootScope.$on('downloadFile', function(event, file) {
			DownloadService.downloadFile(file);
		});

		$scope.download = function(download, info) {
			if ($scope.downloadsPinned) {
				download.info = info;
				if ($scope.pinnedDownloads[download.id]) {
					$scope.unpinDownload(download);
				} else {
					$scope.pinnedDownloads[download.id] = download;
					$scope.pinnedDownloadCount++;
					$scope.pinnedDownloadSize += download.size;
					$scope.$broadcast('downloadPinned', download);
				}
			} else {
				//noinspection JSHint
				alert('Here\'s the file! You\'re welcome!	');
			}
		};

		$rootScope.showNotification = function(message, ttl) {
			ttl = ttl || 3000;
			var i = _.max(_.map(_.keys($scope.notifications).concat([0]), parseInt)) + 1;
			$scope.notifications[i] = { message: message, ttl: ttl };
			$timeout(function() {
				delete $scope.notifications[i];
			}, ttl);
		};

		$scope.unpinDownload = function(download) {
			delete $scope.pinnedDownloads[download.id];
			$scope.pinnedDownloadCount--;
			$scope.pinnedDownloadSize -= download.size;
			$scope.$broadcast('downloadUnpinned', download);
		};

		$scope.downloadPinned = function() {
			//noinspection JSHint
			alert('You would now get a zip file with everthing included.');
		};

		$scope.helpPinnedDownloads = function() {
			$modal.open({
				templateUrl: '/partials/modals/helpPinnedDownloads.html'
			});
		};

		$rootScope.login = function(opts) {
			$modal.open({
				templateUrl: '/auth/modal-login.html',
				controller: 'LoginCtrl',
				windowClass: 'theme-light',
				resolve: { opts: function() { return opts; } }
			});
		};

		$rootScope.mdfiddleText =
			'# Heading 1\n' +
			'## Heading 2\n' +
			'### Heading 3\n' +
			'\n' +
			'A paragraph is just text and it can\n' +
			'go over multiple lines, meaning if you\n' +
			'add one line break, it will be ignored.\n' +
			'\n' +
			'Add two line breaks and you got a new paragraph! Write *italic* or **bold** like so.\n' +
			'\n' +
			'You can easily do lists:\n' +
			'\n' +
			'- Point one\n' +
			'- Point two\n' +
			'\n' +
			'Asterisks work the same:\n' +
			'\n' +
			'* Hello\n' +
			'* World!\n' +
			'\n' +
			'You can also do numbered lists:\n' +
			'\n' +
			'1. Number one\n' +
			'2. Number two\n' +
			'\n' +
			'And quotes:\n' +
			'\n' +
			'> Weather forecast for tonight: dark.\n' +
			'\n' +
			'For the geeks, you can do easily code blocks by \n' +
			'adding 4 spaces before every line:\n' +
			'\n' +
			'    Const DisableSlingShotFlashers = 1\n' +
			'    Const DisableBumberFlashers = 0\n' +
			'\n' +
			'If you have `code` in a paragraph, add backticks.\n' +
			'You can add links [like this](https://google.com/).\n' +
			'\n' +
			'If you want to link an image, just put an exclamation mark in front of it:\n' +
			'![Random Image](http://lorempixel.com/400/200/)\n' +
			'\n' +
			'Want to put a horizontal line? You guessed it:\n' +
			'\n' +
			'-------------------------- \n' +
			'Want to know more? Check out [the full syntax](http://daringfireball.net/projects/markdown/syntax)!'
		;
		$rootScope.mdfiddle = $rootScope.mdfiddleText;

	});