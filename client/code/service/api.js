/**
 *
 */
services.factory('UserResource', function($resource) {
	return $resource('/api/users/:userid', {}, {
		'register': { method: 'POST' }
	});
});
