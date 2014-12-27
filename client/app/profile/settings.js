"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, AuthService, ApiHelper, ProfileResource) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		var user = AuthService.getUser();

		$scope.updatedUser = _.pick(user, 'name', 'location', 'email'); // user profile that will be sent for update
		$scope.localUser = {};                                          // local user for changing password
		$scope.localCredentials = {};                                   // local credentials object

		$scope.providers = AuthService.getProviders(user);
		var allProviders = AuthService.getProviders();

		/**
		 * First block: Update "public" user profile data
		 */
		$scope.updateUserProfile = function() {
			ProfileResource.patch($scope.updatedUser, function(user) {
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);
				$scope.showNotification('User Profile successfully saved.');

			}, ApiHelper.handleErrors($scope));
		};


		/**
		 * CHANGE PASSWORD
		 * Updates local password.
		 */
		$scope.changePassword = function() {

			ApiHelper.clearErrors($scope);

			// password match is checked locally, no such test on server side.
			if (!checkPasswordConfirmation($scope.localUser)) {
				return;
			}

			// update server side
			ProfileResource.patch({
				current_password: $scope.localUser.currentPassword,
				password: $scope.localUser.password1
			}, function() {
				$scope.localUser = {};
				ApiHelper.clearErrors($scope);
				$scope.showNotification('Password successfully changed.', 3000);

			}, ApiHelper.handleErrors($scope));
		};


		/**
		 * LOCAL CREDENTIALS
		 * Create new local credentials if the user was only registered via
		 * OAuth2.
		 */
		$scope.createLocalCredentials = function() {

			ApiHelper.clearErrors($scope);

			// password match is checked locally, no such test on server side.
			if (!checkPasswordConfirmation($scope.localCredentials)) {
				return;
			}

			// update server side
			ProfileResource.patch({
				username: $scope.localCredentials.username,
				password: $scope.localCredentials.password1
			}, function(user) {
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);
				$scope.showNotification('Local credentials successfully created. You may login with username <strong>' + $scope.localCredentials.username + '</strong> now.', 5000);

			}, ApiHelper.handleErrors($scope));
		};

		// pre-fill (local) username from first provider we find.
		var i, provider;
		for (i = 0; i < allProviders.length; i++) {
			provider = allProviders[i];
			if (user[provider.id] && user[provider.id].username) {
				$scope.localCredentials.username = user[provider.id].username;
				break;
			}
		}


		/**
		 * Checks that two passwords field are filled and equal and applies
		 * errors to scope.
		 *
		 * @param {object} credentials Objection containing `password1` and `password2`.
		 * @returns {boolean} True on success, false otherwise.
		 */
		var checkPasswordConfirmation = function(credentials) {
			if (!credentials.password1) {
				ApiHelper.setError($scope, 'password', "You must provide your new password.");
				return false;
			}
			if (!credentials.password2) {
				ApiHelper.setError($scope, 'password2', "You must confirm your new password.");
				return false;
			}
			if (credentials.password1 !== credentials.password2) {
				ApiHelper.setError($scope, 'password2', "The second password must match the first password.");
				return false;
			}
			return true;
		};

	});

