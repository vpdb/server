'use strict';

var _ = require('underscore');
var ACL = require('acl');
var logger = require('winston');
var mongoose = require('mongoose');

var User = mongoose.model('User');
var acl = new ACL(new ACL.memoryBackend());

var init = function(next) {

	// permissions
	acl.allow([
		{
			roles: 'admin',
			allows: [
				{ resources: 'users', permissions: '*' },
				{ resources: 'roles', permissions: '*' }
			]
		}, {
			roles: 'member',
			allows: [
				{ resources: 'users', permissions: 'view' },
				{ resources: 'content', permissions: 'download' }
			]
		}
	]);

	// hierarchy
	acl.addRoleParents('root', [ 'admin' ]);
	acl.addRoleParents('admin', [ 'member' ]);

	// apply to all users
	User.find({}, function(err, users) {
		if (err) {
			logger.error('[acl] Error finding users for ACLs: ', err);
			return next(err);
		}

		logger.info('[acl] Applying ACLs to %d users...', users.length);
		_.each(users, function(user) {
			acl.addUserRoles(user.email, user.roles);
		});
		logger.info('[acl] ACLs applied.');
		next(null, acl);
	});

};

acl.init = init;
module.exports = acl;
