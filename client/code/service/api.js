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
