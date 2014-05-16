/**
 *
 */
services.factory('UserResource', function($resource) {
	return $resource('/api/users/:userid', {}, {
		'register': { method: 'POST' },
		'login': { method: 'POST', params: { userid : 'login'} },
		'logout': { method: 'POST', params: { userid : 'logout'} }
	});
});
