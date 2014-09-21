"use strict";

/* Controllers */
var ctrl = angular.module('vpdb.controllers', []);
ctrl.controller('AppCtrl', function($scope, $rootScope, $location, $modal, UserResource, AuthService, ProfileService, PingResource) {

	$rootScope.themeName = 'theme-dark';
	$rootScope.auth = AuthService;

	$scope.menu = 'home';
	$scope.downloadsPinned = false;
	$scope.pinnedDownloads = {};
	$scope.pinnedDownloadCount = 0;
	$scope.pinnedDownloadSize = 0;
	$scope.loading = false;

	AuthService.init();
	ProfileService.init();
	PingResource.get();

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

ctrl.controller('LoginCtrl', function($scope, $rootScope, $modalInstance, ApiHelper, AuthService, AuthResource, UserResource) {

	$scope.registering = false;
	$scope.loginUser = {};
	$scope.registerUser = {};
	$scope.message = null;
	$scope.error = null;
	$scope.errors = {};

	$scope.login = function() {

		AuthResource.authenticate($scope.loginUser, function(result) {
			$scope.errors = {};
			$scope.error = null;
			AuthService.authenticated(result);
			$modalInstance.close();

		}, ApiHelper.handleErrors($scope));
	};

	$scope.register = function() {

		UserResource.register($scope.registerUser, function() {
			$scope.errors = {};
			$scope.error = null;
			$scope.registerUser = {};
			$scope.message = 'Registration successful. You can now login.';
			$scope.registering = !$scope.registering;
		}, ApiHelper.handleErrors($scope));
	};

	$scope.swap = function() {
		$scope.registering = !$scope.registering;
		$scope.message = null;
		$scope.errors = {};
		$scope.error = null;
	};

});

ctrl.controller('AuthCallbackCtrl', function($routeParams, $location, $modal, AuthResource, AuthService) {
	AuthResource.authenticateCallback($routeParams, function(result) {
		AuthService.authenticated(result);
		$location.url('/');
		$location.replace();
	}, function(err) {
		$location.url('/');
		$location.replace();
		$modal.open({
			templateUrl: 'partials/modals/error.html',
			controller: 'ErrorModalCtrl',
			resolve: {
				errorTitle: function() { return 'Could not login.'; },
				errorMessage: function() { return err.data.error; }
			}
		});
	});
});

ctrl.controller('CollapseCtrl', function($scope) {
	$scope.isCollapsed  = false;
});

ctrl.controller('CommentsCtrl', function($scope) {

	$scope.newComment = '';
	$scope.addComment = function() {
		if (!$scope.release.comments) {
			$scope.release.comments = [];
		}
		if ($scope.newComment.length > 0) {
			$scope.release.comments.push({
				author: {
					user: 'You'
				},
				timestamp: new Date().toISOString(),
				message: $scope.newComment
			});
			$scope.newComment = '';
		}
	};

	$scope.deleteComment = function() {
		$scope.release.comments.splice($scope.release.comments.indexOf($scope.comment), 1);
	};

});

ctrl.controller('CommentCtrl', function($scope) {

	$scope.editing = false;
	$scope.editComment = function() {
		$scope.updatedComment = $scope.comment.message;
		$scope.editing = true;
	};

	$scope.saveComment = function() {
		$scope.comment.message = $scope.updatedComment;
		$scope.editing = false;
	};
	$scope.cancelEdit = function() {
		$scope.editing = false;
	};
});

ctrl.controller('UserDetailCtrl', function($scope, $http, username) {

	$scope.loading = true;
	$http({
		method: 'GET',
		url: '/api-mock/users/' + username
	}).success(function(data, status, headers, config) {
		$scope.user = data.result;
	});
});

ctrl.controller('ErrorModalCtrl', function($scope, errorTitle, errorMessage) {
	$scope.errorTitle = errorTitle;
	$scope.errorMessage = errorMessage;
});

ctrl.controller('InfoModalCtrl', function($scope, title, subtitle, message, icon) {
	$scope.title = title;
	$scope.subtitle = subtitle;
	$scope.message = message;
	$scope.icon = icon;
});

ctrl.controller('DevsiteCtrl', function($scope, $location, $rootScope) {
	if (/(\d+)\.\d+$/.test($location.path())) {
		$scope.section = $location.path().match(/(\d+)\.\d+$/)[1];
	}
	$rootScope.$on('$routeChangeSuccess', function(event, route) {
		$scope.subsection = route.params.section;
	});
	$scope.scrollTo = function(id) {
		var old = $location.hash();
		$location.hash(id);
		$anchorScroll();
		//reset to old to keep any additional routing logic from kicking in
		$location.hash(old);
	};
});

