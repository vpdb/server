"use strict"; /* global common, _ */

common
	.controller('AppCtrl', function($scope, $rootScope, $location, $modal, $localStorage, UserResource, AuthService, ProfileService) {

		$rootScope.themeName = 'theme-dark';
		$rootScope.auth = AuthService;
		$rootScope.$storage = $localStorage;
		$rootScope.currentUrl = $location.path();
		$rootScope.loginParams = {
			open: false,
			localOnly: false
		};
		$rootScope.errorFlash = null;

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
		$scope.$on('$routeChangeSuccess', function() {

			if ($rootScope.errorFlash) {
				var flash = _.clone($rootScope.errorFlash);
				$rootScope.errorFlash = null;
				$modal.open({
					templateUrl: '/common/modal-error.html',
					controller: 'ErrorModalCtrl',
					resolve: {
						errorTitle: function() { return flash.title; },
						errorMessage: function() { return flash.response.data.error; }
					}
				});
			}
		});

		$scope.navGame = function(key) {
			$location.hash('');
			$location.path('/game/' + key);
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

		$scope.icon = function(icon) {
			return '#icon-' + icon;
		};

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
			var i = _.max(_.map(_.keys($scope.notifications).concat(0), function(key) { return parseInt(key); })) + 1;
			$scope.notifications[i] = { message: message, ttl: ttl || 3000 };
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

		$rootScope.login = function() {
			$modal.open({
				templateUrl: '/auth/modal-login.html',
				controller: 'LoginCtrl',
				windowClass: 'theme-light'
			});
		};
	});