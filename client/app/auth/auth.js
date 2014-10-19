"use strict"; /* global _ */

angular.module('vpdb.auth', [])

	.config(function($httpProvider) {
		$httpProvider.interceptors.push('AuthInterceptor');
	})

	.factory('AuthService', function($window, $localStorage, $sessionStorage, $rootScope, $location, Config) {

		return {

			user: null,
			isAuthenticated: false,
			timeout: null,

			/**
			 * Should be called when the app initializes. Reads data from storage into Angular.
			 */
			init: function() {
				this.user = this.getUser();
				this.isAuthenticated = this.user ? true : false;
				this.permissions = this.user ? this.user.permissions : null;
				this.roles = this.user ? this.user.roles: null;
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
				// only update if there already is a token. this is to avoid refreshing the token
				// when the server didn't send a refresh token but browser still passes the header
				// due to a 302.
				if (this.hasToken()) {
					this.saveToken(token);
				}
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
				this.roles = user.roles;
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
				return new Date(exp).getTime() < new Date().getTime();
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
				return claims.iss;
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
				delete $localStorage.tokenCreated;
			},


			/**
			 * Appends the auth token to the URL as query parameter. This is for
			 * resources where we can't put it into the header because of the
			 * browser doing the request (like /storage paths).
			 *
			 * @param {string|object} baseUrl URL to append to. If an object is passed, all props with key `url` will be updated.
			 * @param isProtected Only add if set true
			 * @returns {string} URL with appended auth token if `isProtected` was true.
			 */
			setUrlParam: function(baseUrl, isProtected) {
				if (!baseUrl) {
					return false;
				}
				if (!isProtected) {
					return baseUrl;
				}
				if (_.isObject(baseUrl)) {
					var that = this;
					return traverse.map(baseUrl, function(url) {
						if (this.key === 'url') {
							this.update(url + (~url.indexOf('?') ? '&' : '?') + 'jwt=' + that.getToken());
						}
					});
				} else {
					return baseUrl + (~baseUrl.indexOf('?') ? '&' : '?') + 'jwt=' + this.getToken();
				}
			},

			/**
			 * Returns the authorization header from the app configuration.
			 * @returns {string}
			 */
			getAuthHeader: function() {
				return Config.authHeader;
			}
		};
	})


	.factory('AuthInterceptor', function(AuthService) {
		return {
			request: function(config) {
				config.headers = config.headers || {};

				if (config.url.substr(0, 5) === '/api/') {
					// dont "internally cache" (as in: don't make the request at all) anything from the api.
					config.cache = false;
				}
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

				// only for api calls we can be sure that the token is not cached and therefore correct.
				if (token && response.config.url.substr(0, 5) === '/api/') {
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
	})



