"use strict"; /* global common, _ */

common
	.factory('AuthResource', function($resource) {
		return $resource($rootScope.config.apiUri.path + '/authenticate/:strategy', {}, {
			authenticate: { method: 'POST' },
			authenticateCallback: { method: 'GET' }
		});
	})

	.factory('FileResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/files/:id', {}, {
		});
	})

	.factory('GameResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/games/:id', {}, {
			head: { method: 'HEAD' }
		});
	})

	.factory('IpdbResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/ipdb/:id', {}, {
		});
	})

	.factory('PingResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/ping', {}, {});
	})

	.factory('ProfileResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/user', {}, {});
	})

	.factory('RolesResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/roles/:role', {}, {
		});
	})

	.factory('TagResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/tags/:id', {}, {
		});
	})

	.factory('UserResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/users/:userid', {}, {
			update: { method: 'PUT' },
			register: { method: 'POST' },
			login: { method: 'POST', params: { userid : 'login'} },
			logout: { method: 'POST', params: { userid : 'logout'} }
		});
	})

	.factory('VPBuildResource', function($resource, $rootScope) {
		return $resource($rootScope.config.apiUri.path + '/vpbuilds/:id', {}, {
		});
	})

	.factory('ApiHelper', function($modal) {
		return {
			handleErrors: function(scope) {
				return function(response) {
					scope.message = null;
					scope.errors = {};
					scope.error = null;
					if (response.data.errors) {
						_.each(response.data.errors, function(err) {
							scope.errors[err.field] = err.message;
						});
					}
					if (response.data.error) {
						scope.error = response.data.error;
					}
				};
			},

			handleErrorsInDialog: function(scope, title, callback) {
				return function(response) {
					scope.setLoading(false);
					$modal.open({
						templateUrl: 'partials/modals/error.html',
						controller: 'ErrorModalCtrl',
						resolve: {
							errorTitle: function() { return title; },
							errorMessage: function() { return response.data.error; }
						}
					});
					if (callback) {
						callback(response);
					}
				};
			}
		};
	});
