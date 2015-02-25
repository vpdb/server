"use strict"; /* global common, parseUri, objectPath, _ */

common
	.factory('AuthResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/authenticate/:strategy'), {}, {
			authenticate: { method: 'POST' },
			authenticateCallback: { method: 'GET' }
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

	.factory('GameResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:id'), {}, {
			head: { method: 'HEAD' }
		});
	})

	.factory('GameRatingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/games/:gameId/rating'), {}, {
			'update': { method: 'PUT' }
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
		});
	})

	.factory('ReleaseCommentResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/comments'), {}, {
		});
	})

	.factory('ReleaseRatingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/releases/:releaseId/rating'), {}, {
			'update': { method: 'PUT' }
		});
	})

	.factory('TagResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/tags/:id'), {}, {
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

	.factory('ApiHelper', function($modal, $rootScope, $location, ModalService, ModalFlashService) {
		return {

			handlePagination: function(scope, callback) {
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
			 * @param {function} [fct] Executed if provided with given scope as argument.
			 */
			handleErrors: function(scope, fct) {
				return function(response) {
					scope.message = null;
					scope.errors = { __count: 0 };
					scope.error = null;
					if (response.data.errors) {
						_.each(response.data.errors, function(err) {
							objectPath.set(scope.errors, err.field, err.message);
							scope.errors.__count++;
						});
					}
					if (response.data.error) {
						scope.error = response.data.error;
					}
					if (fct) {
						fct(scope);
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
			 * @param {message} Error message
			 */
			setError: function(scope, field, message) {
				scope.errors = scope.errors || { __count: 0 };
				objectPath.set(scope.errors, field, message);
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
	});
