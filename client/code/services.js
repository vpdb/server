'use strict';

/* Services */
var services = angular.module('vpdb.services', []);

services.factory('DisplayService', function() {
	return {
		media: function(type) {
			switch (type) {
				case 'backglass':
					return 'Backglass';
				case 'flyer':
					return 'Flyer';
				case 'instructioncard':
					return 'Instruction Card';
				default:
					return 'Unknown';
			}
		},

		fileIcon: function(mimeType) {
			switch (mimeType) {
				case 'application/x-visual-pinball-table':   return 'icon-ext-vpt';
				case 'application/x-visual-pinball-table-x': return 'icon-ext-vpx';
				case 'application/vbscript':                 return 'icon-ext-code';
				case 'audio/mpeg':                           return 'icon-ext-audio';
				case 'image/jpeg':
				case 'image/png':                            return 'icon-ext-image';
				case 'text/plain':                           return 'icon-ext-txt';
				case 'video/mp4':
				case 'video/x-flv':                          return 'icon-ext-video';
				default:                                     return 'icon-ext';
			}
		}
	}
});

app.factory('ProfileService', function($rootScope, ProfileResource) {
	return {
		init: function() {

			// this is primarily used by AuthService in order to avoid cyclic deps.
			$rootScope.$on('updateUser', function() {
				ProfileResource.get(function(user) {
					$rootScope.$broadcast('userUpdated', user);
				}, function(err) {
					console.log('Error retrieving user profile: %s', err);
				})
			})
		}
	}
});


app.factory('AuthService', function($window, $localStorage, $sessionStorage, $rootScope, $location) {
	return {

		user: null,
		isAuthenticated: false,
		timeout: null,
		authHeader: 'Authorization',

		/**
		 * Should be called when the app initializes. Reads data from storage into Angular.
		 */
		init: function() {
			this.user = this.getUser();
			this.isAuthenticated = this.user ? true : false;
			this.permissions = this.user ? this.user.permissions : null;
			this.roles = this.user ? this.user.rolesAll : null;
			var that = this;
			$rootScope.$on('userUpdated', function(event, user) {
				that.saveUser(user);
			});
		},

		/**
		 * Executed after successful API authentication using where we receive
		 * the user object along with the JWT.
		 *
		 * @param result Object with keys `token`, `expires` and `user`.
		 */
		authenticated: function(result) {
			this.saveToken(result.token);
			this.saveUser(result.user);
		},

		/**
		 * Executed after successful OAuth authentication using a callback URL
		 * where we only retrieve the token from the view and need to make
		 * further requests for user info.
		 *
		 * @param token JWT, as string
		 */
		tokenReceived: function(token) {

			this.saveToken(token);
			$rootScope.$broadcast('updateUser');
		},

		/**
		 * Executed after token refresh, where only the token but not the user
		 * is updated.
		 * @param token JWT, as string
		 */
		tokenUpdated: function(token) {
			this.saveToken(token);
		},

		/**
		 * Clears token, resulting in not being authenticated anymore.
		 */
		logout: function() {
			this.deleteToken();
			$location.url('/');
		},

		/**
		 * Checks whether the currently logged user has a given permission.
		 * Returns false if not logged.
		 *
		 * @param resourcePermission
		 * @returns {boolean} True if user has permission, false otherwise.
		 */
		hasPermission: function(resourcePermission) {
			var p = resourcePermission.split('/');
			var resource = p[0];
			var permission = p[1];
			return this.permissions && _.contains(this.permissions[resource], permission);
		},

		/**
		 * Checks whether the currently logged user has a given role.
		 * Returns false if not logged.
		 *
		 * @param role
		 * @returns {boolean} True if user has role, false otherwise.
		 */
		hasRole: function(role) {
			if (_.isArray(role)) {
				for (var i = 0; i < role.length; i++) {
					if (this.roles && _.contains(this.roles, role[i])) {
						return true;
					}
				}
				return false;
			} else {
				return this.roles && _.contains(this.roles, role);
			}
		},

		/**
		 * Returns the user from browser storage.
		 * @returns {Object}
		 */
		getUser: function() {
			return $localStorage.user;
		},

		/**
		 * Saves the user data to browser storage. Called after user profile update
		 * or successful authentication.
		 * @param user
		 */
		saveUser: function(user) {
			$localStorage.user = user;
			this.isAuthenticated = true;
			this.user = user;
			this.permissions = user.permissions;
			this.roles = user.rolesAll;
		},

		/**
		 * Checks if the current JWT is expired.
		 * Returns true if no token set.
		 *
		 * @returns {boolean}
		 */
		isTokenExpired: function() {
			var exp = $localStorage.tokenExpires;
			if (!exp) {
				return true;
			}
			return new Date(exp).getTime() < new Date().getTime()
		},

		/**
		 * Checks if there is a valid token. If there is an expired token, it
		 * is deleted first.
		 *
		 * @returns {boolean}
		 */
		hasToken: function() {
			if (this.isTokenExpired()) {
				this.deleteToken();
				return false;
			}
			return $localStorage.jwt ? true : false;
		},

		/**
		 * Returns the token from browser storage.
		 * @returns {*}
		 */
		getToken: function() {
			return $localStorage.jwt;
		},

		/**
		 * Saves the token to browser storage.
		 * @param {String} token JWT
		 * @returns {String} User ID stored in the token (Issuer Claim)
		 */
		saveToken: function(token) {
			var claims = angular.fromJson($window.atob(token.split('.')[1]));

			$localStorage.jwt = token;
			$localStorage.tokenExpires = claims.exp;
			$localStorage.tokenCreated = claims.iat;
			return claims.iss
		},

		/**
		 * Removes the token from browser storage.
		 */
		deleteToken: function() {
			this.user = null;
			this.isAuthenticated = false;
			delete this.permissions;
			delete this.roles;

			delete $localStorage.jwt;
			delete $localStorage.user;
			delete $localStorage.tokenExpires;
		},

		setAuthHeader: function(authHeader) {
			this.authHeader = authHeader;
		},

		getAuthHeader: function() {
			return this.authHeader;
		}

	};
});

app.factory('AuthInterceptor', function(AuthService) {
	return {
		request: function(config) {
			config.headers = config.headers || {};
			if (AuthService.hasToken()) {
				config.headers[AuthService.getAuthHeader()] = 'Bearer ' + AuthService.getToken();
			}
			return config;
		},
		response: function(response) {
			if (response.status === 401) {
				console.log('oops, 401.');
				return response;
			}
			var token = response.headers('x-token-refresh');
			if (token) {
				var dirty = parseInt(response.headers('x-user-dirty'));
				if (dirty > 0) {
					// force user update
					AuthService.tokenReceived(token);
					console.log(response.config.url + ' ' + response.status + ' Got dirty flag ' + response.headers('x-user-dirty') + ', updating local user (' + token + ')');
				} else {
					AuthService.tokenUpdated(token);
				}
			}
			return response;
		}
	};
});
