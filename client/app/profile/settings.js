"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileSettingsCtrl', function($scope, $rootScope, AuthService, ApiHelper, ProfileResource, ModalService) {

		$scope.theme('dark');
		$scope.setTitle('Your Profile');
		//$scope.setMenu('admin');

		AuthService.refreshUser();

		$scope.localUser = {};                                          // local user for changing password
		$scope.localCredentials = {};                                   // local credentials object
		$rootScope.$watch('auth.user', function(value) {
			$scope.updatedUser = _.pick(value, 'name', 'location', 'email');
		});

		$scope.providers = AuthService.getProviders($scope.auth.user);
		var allProviders = AuthService.getProviders();

		/**
		 * First block: Update "public" user profile data
		 */
		$scope.updateUserProfile = function() {

			var updatedUser = AuthService.user.email_status && AuthService.user.email_status.code === 'pending_update' ? _.omit($scope.updatedUser, 'email') : $scope.updatedUser;
			ProfileResource.patch(updatedUser, function(user) {

				if (user.email_status && user.email_status.code === 'pending_update' && !AuthService.user.email_status) {
					$rootScope.showNotification('User Profile successfully saved.<br>A confirmation mail has been sent to your new email address so we can make sure we got the right one.', 10000);
				} else {
					$rootScope.showNotification('User Profile successfully saved.');
				}
				AuthService.saveUser(user);
				ApiHelper.clearErrors($scope);

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
				$rootScope.showNotification('Password successfully changed.', 3000);

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
				$rootScope.showNotification('Local credentials successfully created. You may login with username <strong>' + $scope.localCredentials.username + '</strong> now.', 5000);

			}, ApiHelper.handleErrors($scope));
		};

		$scope.abortEmailUpdate = function() {
			ModalService.question({
				title: 'Cancel Email Update?',
				message: 'You have asked to change your email address to "' + AuthService.user.email_status.value + '" but we\'re still waiting for you to confirm the mail we\'ve sent you.',
				question: 'Do you want to set your email back to "' + AuthService.user.email + '"?'
			}).result.then(function() {
				ProfileResource.patch({ email: AuthService.user.email }, function(user) {
					AuthService.saveUser(user);
					ApiHelper.clearErrors($scope);
					$rootScope.showNotification('Email is set back to <b>' + AuthService.user.email + '</b>.');
				});
			});
		};

		// pre-fill (local) username from first provider we find.
		var i, provider;
		for (i = 0; i < allProviders.length; i++) {
			provider = allProviders[i];
			if ($scope.auth.user[provider.id] && $scope.auth.user[provider.id].username) {
				$scope.localCredentials.username = $scope.auth.user[provider.id].username;
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

