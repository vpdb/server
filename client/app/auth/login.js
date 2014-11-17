"use strict"; /* global _ */

angular.module('vpdb.login', [])

	.controller('LoginCtrl', function($scope, $rootScope, $modalInstance, ApiHelper, AuthService, AuthResource, UserResource) {

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

	})

	.controller('AuthCallbackCtrl', function($routeParams, $location, $modal, AuthResource, AuthService) {
		AuthResource.authenticateCallback($routeParams, function(result) {
			AuthService.authenticated(result);
			$location.url('/');
			$location.replace();
		}, function(err) {
			$location.url('/');
			$location.replace();
			$modal.open({
				templateUrl: '/common/modal-error.html',
				controller: 'ErrorModalCtrl',
				resolve: {
					errorTitle: function() { return 'Could not login.'; },
					errorMessage: function() { return err.data.error; }
				}
			});
		});
	});
