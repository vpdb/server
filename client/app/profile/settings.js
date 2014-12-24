"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, AuthService, ApiHelper, ProfileResource) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		$scope.notifications = {};

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

		$scope.createLocalCredentials = function() {
			ProfileResource.patch($scope.updatedUser, function(user) {
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);

				var i = _.max(_.map(_.keys($scope.notifications).concat(0), function(key) { return parseInt(key); })) + 1;
				$scope.notifications[i] = 'User Profile successfully saved.';

			}, ApiHelper.handleErrors($scope));
		};

	});

