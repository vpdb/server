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
				{ resources: 'users', permissions: [ 'list', 'update', 'delete' ] },
				{ resources: 'users', permissions: 'update' },
				{ resources: 'roles', permissions: '*' }
			]
		}, {
			roles: 'contributor',
			allows: [
				{ resources: 'games', permissions: [ 'edit', 'add' ]},
				{ resources: 'ipdb', permissions: 'view' },
				{ resources: 'files', permissions: 'upload' }
			]
		}, {
			roles: 'member',
			allows: [
				{ resources: 'user', permissions: 'profile' },
				{ resources: 'users', permissions: 'view' },
				{ resources: 'files', permissions: 'download' }
			]
		}, {
			roles: 'mocha',
			allows: [
				{ resources: 'users', permissions: 'delete' }
			]
		}
	])

	// hierarchy
	.then(function() { return acl.addRoleParents('root', [ 'admin' ]) })
	.then(function() { return acl.addRoleParents('admin', [ 'member', 'contributor' ]) })

	// apply to all users
	.then(function() {
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
	});

};

acl.init = init;
module.exports = acl;
