var api = require('./common');

exports.list = function(req, res) {
	api.auth(req, res, 'roles', 'list', function() {
		var roles = [
			{
				name: 'root',
				description: 'Super user. Can create, edit and delete everything including admins.'
			}, {
				name: 'admin',
				description: 'Site administrator. Can edit everything but other administrator\'s permissions.'
			}, {
				name: 'member',
				description: 'A registered member. This role every user should have. Removing results in having the same permissions as anonymous.'
			}
		];
		api.success(res, roles);
	});
};
