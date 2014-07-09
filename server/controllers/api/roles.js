var api = require('./common');

exports.list = function(req, res) {
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
		}, {
			name: 'contributor',
			description: 'Permission to edit meta data, e.g. games and media.'
		}
	];
	api.success(res, roles);
};
