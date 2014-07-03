/**
 *
 */
services.factory('UserResource', function($resource) {
	return $resource('/api/users/:userid', {}, {
		update: { method: 'PUT' },
		register: { method: 'POST' },
		login: { method: 'POST', params: { userid : 'login'} },
		logout: { method: 'POST', params: { userid : 'logout'} }
	});
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

		handleErrorsInDialog: function(scope, title) {
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
			}
		}
	};
});
