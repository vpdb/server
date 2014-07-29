
services.factory('AuthResource', function($resource) {
	return $resource('/api/authenticate', {}, {
		authenticate: { method: 'POST' }
	});
});

services.factory('UserResource', function($resource) {
	return $resource('/api/users/:userid', {}, {
		update: { method: 'PUT' },
		register: { method: 'POST' },
		login: { method: 'POST', params: { userid : 'login'} },
		logout: { method: 'POST', params: { userid : 'logout'} }
	});
});

services.factory('ProfileResource', function($resource) {
	return $resource('/api/user', {}, {});
});

services.factory('PingResource', function($resource) {
	return $resource('/api/ping', {}, {});
});


services.factory('RolesResource', function($resource) {
	return $resource('/api/roles/:role', {}, {
	});
});

services.factory('IpdbResource', function($resource) {
	return $resource('/api/ipdb/:id', {}, {
	});
});

services.factory('GameResource', function($resource) {
	return $resource('/api/games/:id', {}, {
		head: { method: 'HEAD' }
	});
});

services.factory('FileResource', function($resource) {
	return $resource('/api/files/:id', {}, {
	});
});

services.factory('TagResource', function($resource) {
	return $resource('/api/tags/:id', {}, {
	});
});

services.factory('VPBuildResource', function($resource) {
	return $resource('/api/vpbuilds/:id', {}, {
	});
});



services.factory('ApiHelper', function($modal) {
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
			}
		},

		handleErrorsInDialog: function(scope, title, callback) {
			return function(response) {
				scope.setLoading(false);
				$modal.open({
					templateUrl: 'partials/modals/error',
					controller: 'ErrorModalCtrl',
					resolve: {
						errorTitle: function() { return title; },
						errorMessage: function() { return response.data.error; }
					}
				});
				if (callback) {
					callback(response);
				}
			}
		}
	};
});
