"use strict"; /* global angular, parseUri, _ */

angular.module('vpdb.common', [])

	.factory('AuthResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/authenticate/:strategy'), {}, {
			authenticate: { method: 'POST' },
			authenticateCallback: { method: 'GET' }
		});
	})

	.factory('BackglassResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/backglasses/:id'), {}, {
		});
	})

	.factory('BackglassModerationResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/backglasses/:id/moderate'), {}, {
		});
	})

	.factory('BuildResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/builds/:id'), {}, {
		});
	})

	.factory('FileResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/files/:id'), {}, {
		});
	})

	.factory('FileBlockmatchResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/files/:id/blockmatch'), {}, {
		});
	})

	.factory('GameResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:id'), {}, {
			head: { method: 'HEAD' },
			update: { method: 'PATCH' }
		});
	})

	.factory('GameRatingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/rating'), {}, {
			'update': { method: 'PUT' }
		});
	})

	.factory('GameStarResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/star'), {}, {
		});
	})

	.factory('GameMediaResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/media'), {}, {
			get: { method: 'GET', isArray: true }
		});
	})

	.factory('GameBackglassResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/backglasses'), {}, {
			get: { method: 'GET', isArray: true }
		});
	})

	.factory('GameReleaseNameResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/release-name'), {}, {});
	})

	.factory('GameRequestResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/game_requests/:id'), {}, {
			update: { method: 'PATCH' }
		});
	})

	.factory('PlanResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/plans'), {}, {
		});
	})

	.factory('IpdbResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/ipdb/:id'), {}, {
		});
	})

	.factory('PingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/ping'), {}, {});
	})

	.factory('ProfileResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/user/:action/:id'), {}, {
			patch: { method: 'PATCH' },
			confirm: { method: 'GET', params: { action: 'confirm' }},
			logs: { method: 'GET', params: { action: 'logs' }, isArray: true }
		});
	})

	.factory('RolesResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/roles/:role'), {}, {
		});
	})

	.factory('RomResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:id/roms'), {}, {
		});
	})

	.factory('ReleaseResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:release'), {}, {
			update: { method: 'PATCH' }
		});
	})

	.factory('ReleaseVersionResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/versions/:version'), {}, {
			update: { method: 'PUT' }
		});
	})

	.factory('ReleaseCommentResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/comments'), {}, {
		});
	})

	.factory('ReleaseRatingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/rating'), {}, {
			update: { method: 'PUT' }
		});
	})

	.factory('ReleaseStarResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/star'), {}, {
		});
	})

	.factory('ReleaseModerationResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/moderate'), {}, {
		});
	})

	.factory('TagResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/tags/:id'), {}, {
		});
	})

	.factory('TokenResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/tokens/:id'), { }, {
			update: { method: 'PATCH' }
		});
	})

	.factory('UserResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/users/:userid'), {}, {
			update: { method: 'PUT' },
			register: { method: 'POST' },
			login: { method: 'POST', params: { userid : 'login'} },
			logout: { method: 'POST', params: { userid : 'logout'} }
		});
	})

	.factory('UserStarResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/users/:userId/star'), {}, {
		});
	})

	.factory('ApiHelper', function($uibModal, $rootScope, $location, ModalService, ModalFlashService) {
		return {

			handlePagination: function(scope, opts, callback) {
				if (_.isFunction(opts)) {
					callback = opts;
				} else {
					opts = opts || {};
				}
				return function(items, headers) {

					scope.pagination = {};
					if (headers('x-list-count')) {
						scope.pagination.count = parseInt(headers('x-list-count'));
						scope.pagination.page = parseInt(headers('x-list-page'));
						scope.pagination.size = parseInt(headers('x-list-size'));
					}

					if (headers('link')) {
						var links = {};
						_.map(headers('link').split(','), function(link) {
							var m = link.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
							var url = m[1];
							links[m[2]] = {
								url: url.replace(/%2C/gi, ','),
								query: parseUri(decodeURIComponent(url)).queryKey
							};
						});
						scope.pagination.links = links;
					}

					if (callback) {
						callback(items, headers);
					}

					if (opts.loader) {
						scope.loading = false;
					}
					delete scope.error;
				};
			},

			/**
			 * Updates the scope with received errors from the API.
			 *
			 * If there were validation errors, an `errors` tree is created
			 * with the field names as property names, otherwise the `error`
			 * variable is just set to the received error.
			 *
			 * @param {object} scope Scope where to create the error variables
			 * @param {object} [opt] config options. Valid options: fieldPrefix
			 * @param {function} [postFct] Executed if provided with given scope as argument, after the errors object has been set
			 * @param {function} [preFct] Executed if provided with given scope as argument, before the errors object has been set.
			 */
			handleErrors: function(scope, opt, postFct, preFct) {
				if (!preFct && _.isFunction(opt)) {
					preFct = postFct;
					postFct = opt;
				}
				opt = _.isObject(opt) ? opt : {};
				return function(response) {
					if (response.status === 401 && response.data.error === "Token has expired") {
						ModalService.error({
							subtitle: "Session timed out",
							message: "Looks like your session has expired. Try logging in again."
						});
						return;
					}
					scope.message = null;
					scope.errors = { __count: 0 };
					scope.error = null;
					if (response.data.errors) {
						if (preFct) {
							preFct(scope, response);
						}
						_.each(response.data.errors, function(err) {
							var path = (opt.fieldPrefix || '') + err.field;
							_.set(scope.errors, path, err.message);
							scope.errors.__count++;
						});
					}
					if (response.data.error) {
						scope.error = response.data.error;
					}
					if (postFct) {
						postFct(scope, response);
					}
				};
			},

			/**
			 * Displays a modal with the received errors from the API.
			 * @param {object} scope Scope where to create the error variables
			 * @param {string} title Title of the modal
			 * @param {function} [callback] Executed if provided with given scope as argument.
			 * @returns {Function}
			 */
			handleErrorsInDialog: function(scope, title, callback) {
				return function(response) {
					var skipError = false;
					if (callback) {
						skipError = callback(response);
					}
					scope.setLoading(false);
					if (!skipError) {
						ModalService.error({
							subtitle: title,
							message: response.data.error
						});
					}
				};
			},

			/**
			 * Displays a modal with the received errors from the API, but on a different page
			 * @param {string} path Page where to navigate before displaying the modal
			 * @param {string} title Title of the modal
			 * @returns {Function}
			 */
			handleErrorsInFlashDialog: function(path, title) {
				return function(response) {
					ModalFlashService.error({
						subtitle: title,
						message: response.data.error
					});
					$location.path(path);
				};
			},

			/**
			 * Manually sets an error to be displayed
			 * @param {object} scope Scope where to create the error variables
			 * @param {string} field Name of the field
			 * @param {message} message Error message
			 */
			setError: function(scope, field, message) {
				scope.errors = scope.errors || { __count: 0 };
				_.set(scope.errors, field, message);
			},

			/**
			 * Resets error tree.
			 * @param {object} scope Scope of the error variables
			 */
			clearErrors: function(scope) {
				scope.message = null;
				scope.errors = { __count: 0 };
				scope.error = null;
			}
		};
	})

	.config(function($httpProvider) {
		$httpProvider.interceptors.push('UpdateInterceptor');
	})

	.factory('UpdateInterceptor', function($rootScope, $localStorage, $timeout) {
		return {
			response: function(response) {
				var sha = response.headers('x-app-sha');
				if (sha && $localStorage.appSha && $localStorage.appSha !== sha) {
					$timeout(function() {
						$rootScope.$emit('appUpdated');
					}, 300);
				}
				if (sha) {
					$localStorage.appSha = sha;
				}
				return response;
			}
		};
	});
