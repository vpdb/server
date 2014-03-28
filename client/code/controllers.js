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
	$scope.comments = [{
		user: 'freezy',
		timestamp: new Date(),
		message: "A very first comment. **Awesome release!**"
	}];
	$scope.addComment = function() {
		if ($scope.newComment.length > 0) {
			$scope.comments.push({
				user: 'freezy',
				timestamp: new Date(),
				message: $scope.newComment
			});
		}

	}
});
