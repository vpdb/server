"use strict"; /* global _ */

angular.module('vpdb.login', [])

	.controller('LoginCtrl', function($scope, $rootScope, $modalInstance, $window,
									  ApiHelper, AuthService, AuthResource, UserResource,
									  opts) {

		opts = opts || {};

		$scope.registering = false;
		$scope.loginUser = {};
		$scope.registerUser = {};
		$scope.message = opts.message || null;
		$scope.error = null;
		$scope.errors = {};
		$scope.topMessage = opts.topMessage || $rootScope.loginParams.message;
		$scope.headMessage = opts.headMessage;

		delete $rootScope.loginParams.message;

		$scope.oauth = function(url) {

			AuthService.setPostLoginRedirect();
			if (opts.postLogin) {
				AuthService.addPostLoginAction(opts.postLogin.action, opts.postLogin.params);
			}
			$window.location.href = url;
		};

		$scope.login = function() {

			AuthService.setPostLoginRedirect();
			if (opts.postLogin) {
				AuthService.addPostLoginAction(opts.postLogin.action, opts.postLogin.params);
			}
			AuthResource.authenticate($scope.loginUser, function(result) {
				$scope.errors = {};
				$scope.error = null;
				$scope.message2 = null;
				AuthService.authenticated(result);
				$modalInstance.close();
				AuthService.runPostLoginActions();

			}, ApiHelper.handleErrors($scope, function() {
				$scope.message2 = null;
			}));
		};

		$scope.register = function() {

			AuthService.setPostLoginRedirect();
			if (opts.postLogin) {
				AuthService.addPostLoginAction(opts.postLogin.action, opts.postLogin.params);
			}
			UserResource.register($scope.registerUser, function() {
				$scope.errors = {};
				$scope.error = null;
				$scope.registerUser = {};
				$scope.message = 'Registration successful.';
				$scope.message2 = 'You will get an email shortly.<br>Once you have confirmed it, you\'re good to go!';
				$scope.registering = !$scope.registering;
			}, ApiHelper.handleErrors($scope));
		};

		$scope.swap = function() {
			$scope.registering = !$scope.registering;
			$scope.message = null;
			$scope.message2 = null;
			$scope.errors = {};
			$scope.error = null;
		};
	})

	.controller('AuthCallbackCtrl', function($stateParams, $modal, AuthResource, AuthService, ModalService) {
		AuthResource.authenticateCallback($stateParams, function(result) {
			AuthService.authenticated(result);
			AuthService.runPostLoginActions();
		}, function(err) {
			ModalService.error({
				subtitle: 'Could not login.',
				message: err.data.error
			});
		});
	})

	.controller('UserEmailConfirmationCtrl', function($stateParams, $location, $rootScope, ApiHelper, ProfileResource, ModalFlashService, AuthService) {
		ProfileResource.confirm({ id: $stateParams.token }, function(result) {
			if (result.previous_code === 'pending_update') {

				ModalFlashService.info({
					title: 'Email Confirmation',
					subtitle: 'Thanks!',
					message: result.message
				});

				if (AuthService.isAuthenticated) {
					$location.path('/profile/settings');
				} else {
					$location.path('/');
				}

			} else {
				$rootScope.loginParams.open = true;
				$rootScope.loginParams.localOnly = true;
				$rootScope.loginParams.message = result.message;
				$location.path('/');
			}


		}, ApiHelper.handleErrorsInFlashDialog('/', 'Token validation error'));
	});
