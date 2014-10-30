"use strict"; /* global app, common, _ */

common

	.controller('CollapseCtrl', function($scope) {
		$scope.isCollapsed  = false;
	})

	.controller('CommentsCtrl', function($scope) {

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

	})

	.controller('CommentCtrl', function($scope) {

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
	})

	.controller('UserDetailCtrl', function($scope, $http, username) {

		$scope.loading = true;
		$http({
			method: 'GET',
			url: '/api-mock/users/' + username
		}).success(function(data, status, headers, config) {
			$scope.user = data.result;
		});
	})

	.controller('ErrorModalCtrl', function($scope, errorTitle, errorMessage) {
		$scope.errorTitle = errorTitle;
		$scope.errorMessage = errorMessage;
	})

	.controller('InfoModalCtrl', function($scope, title, subtitle, message, icon) {
		$scope.title = title;
		$scope.subtitle = subtitle;
		$scope.message = message;
		$scope.icon = icon;
	})