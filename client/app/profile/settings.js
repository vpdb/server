"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, AuthService, ApiHelper, ProfileResource) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		var user = AuthService.getUser();

		// user profile that will be sent for update
		$scope.updatedUser = _.pick(user, 'name', 'location', 'email');

		// local user for changing password
		$scope.localUser = {};

		$scope.providers = AuthService.getProviders(user);
		var allProviders = AuthService.getProviders();

		// pre-fill (local) username from first provider we find.
		var i, provider;
		for (i = 0; i < allProviders.length; i++) {
			provider = allProviders[i];
			if (user[provider.id] && user[provider.id].username) {
				$scope.localUser.username = user[provider.id].username;
				break;
			}
		}

		$scope.updateUserProfile = function() {
			ProfileResource.patch($scope.updatedUser, function(user) {
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);
				$scope.showNotification('User Profile successfully saved.');

			}, ApiHelper.handleErrors($scope));
		};

		$scope.createLocalCredentials = function() {

			ApiHelper.clearErrors($scope);

			// password match is checked locally, no such test on server side.
			if (!$scope.localUser.password1) {
				return ApiHelper.setError($scope, 'password', "You must provide your new password.");
			}
			if (!$scope.localUser.password2) {
				return ApiHelper.setError($scope, 'password2', "You must confirm your new password.");
			}
			if ($scope.localUser.password1 !== $scope.localUser.password2) {
				return ApiHelper.setError($scope, 'password2', "The second password must match the first password.");
			}

			// now patch user on server side
			ProfileResource.patch({
				username: $scope.localUser.username,
				password: $scope.localUser.password1
			}, function(user) {
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);

				$scope.showNotification('Local credentials successfully created. You may login with username <strong>' + $scope.localUser.username + '</strong> now.', 5000);

			}, ApiHelper.handleErrors($scope));

		};

	});

