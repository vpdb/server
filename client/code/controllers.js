'use strict';

/* Controllers */

var ctrl = angular.module('vpdb.controllers', []);


ctrl.controller('AppCtrl', function($scope, $rootScope, $location, $modal, UserResource) {

	$rootScope.themeName = 'theme-dark';
	$scope.menu = 'home';
	$scope.downloadsPinned = false;
	$scope.pinnedDownloads = {};
	$scope.pinnedDownloadCount = 0;
	$scope.pinnedDownloadSize = 0;

	$scope.navGame = function(key) {
		$location.hash('');
		$location.path('/game/' + key);
	};

	$scope.setMenu = function(menu) {
		$scope.menu = menu;
	};

	$scope.theme = function(theme) {
		$rootScope.themeName = 'theme-' + theme;
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
		alert('You would now get a zip file with everthing included.');
	};

	$scope.helpPinnedDownloads = function() {
		$modal.open({
			templateUrl: 'partials/modals/helpPinnedDownloads'
		});
	};

	$rootScope.login = function() {
		$modal.open({
			templateUrl: 'partials/modals/auth',
			controller: 'LoginCtrl'
		});
	};

	$rootScope.logout = function() {
		UserResource.logout(function() {
			$rootScope.user.isAuthenticated = false;
			$rootScope.user.obj = null;
			$rootScope.user.permissions = {};
		});
	};


	$rootScope.loggedIn = function(user) {
		$rootScope.user.isAuthenticated = true;
		$rootScope.user.obj = user;
		$rootScope.user.permissions = user.permissions;
		delete $rootScope.user.obj.permissions;
	};

	$rootScope.hasPermission = function(resourcePermission) {
		var p = resourcePermission.split('/');
		var resource = p[0];
		var permission = p[1];
		return $rootScope.user && $rootScope.user.permissions && _.contains($rootScope.user.permissions[resource], permission);
	};

	$rootScope.hasRole = function(role) {
		return $rootScope.user && $rootScope.user.obj && $rootScope.user.obj.roles && _.contains($rootScope.user.obj.roles, role);
	};

});

ctrl.controller('LoginCtrl', function($scope, $rootScope, $modalInstance, ApiHelper, UserResource) {

	$scope.registering = false;
	$scope.loginUser = {};
	$scope.registerUser = {};
	$scope.message = null;
	$scope.error = null;
	$scope.errors = {};

	$scope.login = function() {
		UserResource.login($scope.loginUser, function(user) {
			$scope.errors = {};
			$scope.error = null;
			$scope.loggedIn(user);
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

