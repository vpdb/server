'use strict';

/* Controllers */

var ctrl = angular.module('vpdb.controllers', []);


ctrl.controller('AppCtrl', function($scope) {
	$scope.scrolledOnTop = true;
	console.log('AppCtrl initialized.');
});


ctrl.controller('CollapseCtrl', function($scope) {
	$scope.isCollapsed  = false;
});

ctrl.controller('CommentCtrl', function($scope) {

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
