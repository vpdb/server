"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, AuthService) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		var user = AuthService.getUser();

		// user profile that will be sent for update
		$scope.updatedUser = _.cloneDeep(user);

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

	});

