"use strict"; /* global common, _ */

common
	.factory('AuthResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/authenticate/:strategy'), {}, {
			authenticate: { method: 'POST' },
			authenticateCallback: { method: 'GET' }
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

	.factory('IpdbResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/ipdb/:id'), {}, {
		});
	})

	.factory('PingResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/ping'), {}, {});
	})

	.factory('ProfileResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/user'), {}, {});
	})

	.factory('RolesResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/roles/:role'), {}, {
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

	.factory('VPBuildResource', function($resource, ConfigService) {
		return $resource(ConfigService.apiUri('/vpbuilds/:id'), {}, {
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
