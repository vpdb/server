"use strict"; /* global angular, traverse, _ */

angular.module('vpdb.auth', [])

	.config(function($httpProvider) {
		$httpProvider.interceptors.push('AuthInterceptor');
	})

	.factory('AuthService', function($window, $localStorage, $sessionStorage, $rootScope, $location, $http, $state, $timeout,
									 Config, ApiHelper, ConfigService, AuthResource, TokenResource, ProfileResource) {
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

				var claims = angular.fromJson($window.atob(result.token.split('.')[1]));

				if (claims.irt === false) {
					$localStorage.initialJwt = result.token;
					$localStorage.initialTokenExpires = new Date(claims.exp).getTime();
					$localStorage.initialTokenCreatedLocal = new Date().getTime();
					$localStorage.initialTokenCreatedServer = new Date(claims.iat).getTime();
				}
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
			 * Retrieves a login token for future auto-login.
			 */
			rememberMe: function() {
				TokenResource.save({ type: 'login' }, function(token) {
					$localStorage.loginToken = token;
				}, ApiHelper.handleErrorsInDialog($rootScope, 'Error creating login token.'));
			},

			/**
			 * Clears token, resulting in not being authenticated anymore.
			 */
			logout: function() {

				var that = this;
				var done = function() {
					that.deleteToken();
					$location.url('/');
				};

				if ($localStorage.loginToken) {
					TokenResource.delete({ id: $localStorage.loginToken.id }, function() {
						delete $localStorage.loginToken;
						done();

					}, ApiHelper.handleErrorsInDialog($rootScope, 'Error deleting login token.', done));

				} else {
					done();
				}
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

			isAuthor: function(release) {
				return release && this.isAuthenticated && _.contains(_.pluck(release.authors, 'user.id'), this.user.id);
			},

			/**
			 * Returns the user from browser storage.
			 * @returns {Object}
			 */
			getUser: function() {
				return $localStorage.user;
			},

			/**
			 * Reloads the user profile data from the server
			 * @returns {promise}
			 */
			refreshUser: function(callback) {
				var that = this;
				return ProfileResource.get(function(user) {
					that.saveUser(user);
					if (callback) {
						callback(null, user);
					}
				}, function(err) {
					if (callback) {
						callback(err);
					}
					console.log('Error retrieving user profile: %s', err);
				});
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
				if (!$localStorage.tokenExpires) {
					return true;
				}
				var timeDiff = $localStorage.tokenCreatedLocal - $localStorage.tokenCreatedServer;
				return $localStorage.tokenExpires + timeDiff < new Date().getTime();
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
			 * Checks if there is a valid login token.
			 * @returns {boolean}
			 */
			hasLoginToken: function() {
				if (!$localStorage.loginToken || !$localStorage.rememberMe) {
					return false;
				}
				if (!$localStorage.loginToken.is_active) {
					return false;
				}
				return new Date($localStorage.loginToken.expires_at).getTime() > new Date().getTime();
			},

			/**
			 * Returns the token from browser storage.
			 * @returns {*}
			 */
			getToken: function() {
				return $localStorage.jwt;
			},

			/**
			 * Returns the login token from browser storage.
			 * @returns {*}
			 */
			getLoginToken: function() {
				return $localStorage.loginToken.token;
			},

			/**
			 * Clears the login token.
			 */
			clearLoginToken: function() {
				delete $localStorage.loginToken;
			},

			/**
			 * Saves the token to browser storage.
			 * @param {String} token JWT
			 * @returns {String} User ID stored in the token (Issuer Claim)
			 */
			saveToken: function(token) {

				var that = this;
				var claims = angular.fromJson($window.atob(token.split('.')[1]));

				$localStorage.jwt = token;
				$localStorage.tokenExpires = new Date(claims.exp).getTime();
				$localStorage.tokenCreatedLocal = new Date().getTime();
				$localStorage.tokenCreatedServer = new Date(claims.iat).getTime();

				// enable timeout notification
				if (this.timeout) {
					$timeout.cancel(this.timeout);
				}
				if (!$localStorage.rememberMe) {
					this.timeout = $timeout(function() {
						that.deleteToken();
						$rootScope.timeoutNoticeCollapsed = false;
					}, $localStorage.tokenExpires - $localStorage.tokenCreatedServer);
				}

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
				delete $localStorage.tokenCreatedLocal;
				delete $localStorage.tokenCreatedServer;

				delete $localStorage.initialJwt;
				delete $localStorage.initialTokenExpires;
				delete $localStorage.initialTokenCreatedLocal;
				delete $localStorage.initialTokenCreatedServer;
			},

			/**
			 * Traverses an object and collects all values of the `url` property.
			 *
			 * @param {object} obj Object to deep-traverse
			 * @param {boolean} [fetch] If set, directly fetch the tokens
			 * @return {AuthService}
			 */
			collectUrlProps: function(obj, fetch) {
				this.paths = this.paths || [];
				var paths = [];
				traverse.forEach(obj, function(value) {
					if (this.key === 'url' && value) {
						paths.push(value);
					}
				});
				this.paths = _.uniq(paths.concat(this.paths));
				if (fetch) {
					this.fetchUrlTokens();
				}
				return this;
			},

			/**
			 * Requests storage tokens for previously collected URLs.
			 * @see #collectUrlProps
			 * @param {array} [paths]
			 * @param {function} [callback]
			 * @return {AuthService}
			 */
			fetchUrlTokens: function(paths, callback) {
				paths = paths || this.paths;
				if (!_.isString(paths) && (!_.isObject(paths) || _.keys(paths).length === 0)) {
					return this;
				}
				var that = this;
				$http({
					method: 'POST',
					url: ConfigService.storageUri('/authenticate'),
					data: { paths: paths }
				}).success(function(data) {
					if (callback) {
						return callback(null, data);
					}
					that.storageTokens = data;
					that.paths = [];
					if (that.storageTokenCallbacks) {
						_.each(data, function(token, path) {
							if (that.storageTokenCallbacks[path]) {
								that.storageTokenCallbacks[path](token);
								delete that.storageTokenCallbacks[path];
							}
						});
					}
				}).error(function(data, status) {
					if (callback) {
						callback(status, data);
					}
					console.error('Error fetching tokens: ' + status);
					console.error(data);
				});
				return this;
			},

			/**
			 * Appends the `token` parameter to an URL from previously
			 * requested storage tokens.
			 *
			 * This is for resources where we can't put a token into the header
			 * because of the browser doing the request (like image URLs).
			 *
			 * @param {string} url
			 * @param {function} callback
			 * @return {AuthService}
			 */
			addUrlToken: function(url, callback) {
				if (this.storageTokens && this.storageTokens[url]) {
					return callback(url + (~url.indexOf('?') ? '&' : '?') + 'token=' + this.storageTokens[url]);
				}
 				if (!_.contains(this.paths, url)) {
					return console.error('Path "%s" neither in collected paths nor in received tokens. Might forgot to collect URL props on some object?', url);
				}
				this.storageTokenCallbacks = this.storageTokenCallbacks || [];
				this.storageTokenCallbacks[url] = function(token) {
					callback(url + (~url.indexOf('?') ? '&' : '?') + 'token=' + token);
				};
				return this;
			},

			/**
			 * Returns the authorization header from the app configuration.
			 * @returns {string}
			 */
			getAuthHeader: function() {
				return Config.authHeader;
			},

			/**
			 * Returns authentication providers. If a user is supplied, only
			 * the providers of the user are returned.
			 *
			 * @param {User} [user]
			 */
			getProviders: function(user) {
				var providers = [];

				if (Config.authProviders.google) {
					providers.push({
						id: 'google',
						icon: 'google-g',
						name: 'Google',
						url: '/auth/google'
					});
				}
				if (Config.authProviders.github) {
					providers.push({
						id: 'github',
						icon: 'github',
						name: 'GitHub',
						url: '/auth/github'
					});
				}
				if (_.isArray(Config.authProviders.ipboard)) {
					providers = providers.concat(Config.authProviders.ipboard);
				}

				if (user) {
					return _.filter(providers, function(provider) {
						return user[provider.id] && !_.isEmpty(user[provider.id]);
					});
				} else {
					return providers;
				}
			},

			/**
			 * Runs previously saved post login actions.
			 */
			runPostLoginActions: function() {
				if ($localStorage.postLoginActions) {
					_.each($localStorage.postLoginActions, function(postLoginAction) {
						switch (postLoginAction.action) {
							case 'redirect':
								$state.go(postLoginAction.params.stateName, postLoginAction.params.stateParams);
								break;
							case 'downloadFile':
								$rootScope.$broadcast('downloadFile', postLoginAction.params);
								break;
							default:
								return;
						}
					});
					$localStorage.postLoginActions = [];
				}
			},

			/**
			 * Adds an action to be executed after successful login
			 * @param action
			 * @param params
			 */
			addPostLoginAction: function(action, params) {
				if (!$localStorage.postLoginActions) {
					$localStorage.postLoginActions = [];
				}
				$localStorage.postLoginActions.push({ action: action, params: params });
			},

			setPostLoginRedirect: function() {
				console.log($state.current);
				this.addPostLoginAction('redirect', { stateName: $state.current.name, stateParams: $state.params });
			}

		};
	})


	.factory('AuthInterceptor', function($injector, $q, ConfigService) {
		return {
			request: function(config) {

				return $q(function(resolve, reject) {

					config.headers = config.headers || {};

					if (ConfigService.isAnyApiUrl(config.url)) {
						// dont "internally cache" (as in: don't make the request at all) anything from the api.
						config.cache = false;

						var AuthService = $injector.get('AuthService');
						// check for valid token
						if (AuthService.hasToken()) {
							config.headers[AuthService.getAuthHeader()] = 'Bearer ' + AuthService.getToken();
							resolve(config);

						// check for autologin token
						} else if (!ConfigService.isAuthUrl(config.url) && AuthService.hasLoginToken()) {

							var AuthResource = $injector.get('AuthResource');
							AuthResource.authenticate({ token: AuthService.getLoginToken() }, function(result) {
								config.headers[AuthService.getAuthHeader()] = 'Bearer ' + result.token;
								AuthService.authenticated(result);
								resolve(config);

							}, function(err) {
								AuthService.clearLoginToken(); // it failed, so no need to keep it around further.
								reject(err);
							});

						} else {
							resolve(config);
						}
					} else {
						resolve(config);
					}

				});
			},
			response: function(response) {
				if (response.status === 401 || response.status === 403) {
					return response;
				}
				var token = response.headers('x-token-refresh');

				// only for api calls we can be sure that the token is not cached and therefore correct.
				if (token && ConfigService.isApiUrl(response.config.url)) {
					var dirty = parseInt(response.headers('x-user-dirty'));
					var AuthService = $injector.get('AuthService');
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



