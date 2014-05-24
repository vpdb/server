/**
 *
 */
services.factory('UserResource', function($resource) {
	return $resource('/api/users/:userid', {}, {
		'update': { method: 'PUT' },
		'register': { method: 'POST' },
		'login': { method: 'POST', params: { userid : 'login'} },
		'logout': { method: 'POST', params: { userid : 'logout'} }
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


services.factory('ApiHelper', function() {
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
		}
	};
});
