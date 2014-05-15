'use strict';

/* Controllers */

var ctrl = angular.module('vpdb.controllers', []);


ctrl.controller('AppCtrl', function($scope, $location, $modal) {

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

	$scope.login = function() {
		$modal.open({
			templateUrl: 'partials/modals/auth',
			controller: 'LoginCtrl'
		});
	};
});


ctrl.controller('LoginCtrl', function($scope, UserResource) {

	$scope.registering = false;
	$scope.loginUser = {};
	$scope.registerUser = {};
	$scope.errors = {};

	var validEmail = function(email) {
		var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(email);
	};

	$scope.login = function(email, password) {
		if (!validEmail(email)) {
			return $scope.error = 'You must provide a valid email address.';
		}
	};

	$scope.register = function() {

		UserResource.register($scope.registerUser, function(a, b, c) {
			console.log(a);
		}, function(error) {
			if (error.status == 422) { // validation error
				$scope.errors = {};
				_.each(error.data.errors, function(err) {
					$scope.errors[err.field] = err.message;
				});
			}
		});

		/*
		if (!validEmail(email)) {
			return $scope.error = 'You must provide a valid email address.';
		}
		if (password1 != password2) {
			return $scope.error = 'Sorry, passwords don\'t match.';
		}*/
	};

	$scope.swap = function() {
		$scope.registering = !$scope.registering;
		$scope.errors = {};
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

