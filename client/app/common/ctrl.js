"use strict"; /* global app, _ */

common
	.controller('AppCtrl', function($scope, $rootScope, $location, $modal, $localStorage, UserResource, AuthService, ProfileService, PingResource) {

		$rootScope.themeName = 'theme-dark';
		$rootScope.auth = AuthService;
		$rootScope.$storage = $localStorage;

		$scope.menu = 'home';
		$scope.downloadsPinned = false;
		$scope.pinnedDownloads = {};
		$scope.pinnedDownloadCount = 0;
		$scope.pinnedDownloadSize = 0;
		$scope.loading = false;

		AuthService.init();
		ProfileService.init();
		//PingResource.get();

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
				templateUrl: 'partials/modals/helpPinnedDownloads.html'
			});
		};

		$rootScope.login = function() {
			$modal.open({
				templateUrl: 'partials/modals/auth.html',
				controller: 'LoginCtrl',
				windowClass: 'theme-light'
			});
		};
	});