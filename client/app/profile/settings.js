"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, AuthService) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		var user = AuthService.getUser();

		$scope.updatedUser = _.cloneDeep(user);

		$scope.localUser = {};

		if (user.github && !_.isEmpty(user.github)) {
			$scope.localUser.username = user.github.username;
		}

		$scope.providers = AuthService.getProviders(user);

	});

