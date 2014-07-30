"use strict"; /*global describe, before, after, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The ACLs of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
			admin2: { roles: [ 'admin' ]},
			contributor: { roles: [ 'contributor' ]},
			member: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		// app.get('/api/users',         api.auth(api.users.list, 'users', 'list'));
		it('should deny access to user list', function(done) {
			request
				.get('/api/users')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});
		it('should deny access to user search', function(done) {
			request
				.get('/api/users?q=123')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.put('/api/users/:id',     api.auth(api.users.update, 'users', 'update'));
		it('should deny access to user update', function(done) {
			request
				.put('/api/users/1234567890abcdef')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.delete('/api/users/:id',  api.auth(api.users.delete, 'users', 'delete'));
		it('should deny access to user delete', function(done) {
			request
				.del('/api/users/1234567890abcdef')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/user',          api.auth(api.users.profile, 'user', 'profile'));
		it('should deny access to user profile', function(done) {
			request
				.get('/api/user')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/roles',         api.auth(api.roles.list, 'roles', 'list'));
		it('should deny access to roles list', function(done) {
			request
				.get('/api/roles')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/ipdb/:id',      api.auth(api.ipdb.view, 'ipdb', 'view'));
		it('should deny access to ipdb query', function(done) {
			request
				.get('/api/ipdb/4441')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.post('/api/files',         api.auth(api.files.upload, 'files', 'upload'));
		it('should deny access to file upload', function(done) {
			request
				.post('/api/files')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.delete('/api/files/:id',  api.auth(api.files.delete, 'files', 'delete'));
		it('should deny access to file deletion', function(done) {
			request
				.del('/api/files/123456789')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.head('/api/games/:id',    api.anon(api.games.head));
		it('should allow check for existing games', function(done) {
			request
				.head('/api/games/mb')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		// app.post('/api/games',        api.auth(api.games.create, 'games', 'add'));
		it('should deny access to game creation', function(done) {
			request
				.post('/api/games')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/ping',          api.anon(api.ping));
		it('should allow access to ping', function(done) {
			request
				.get('/api/ping')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		// app.get('/api/tags',          api.anon(api.tags.list));
		it('should allow to list tags', function(done) {
			request
				.get('/api/tags')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		// app.post('/api/tags',         api.auth(api.tags.create, 'tags', 'add'));
		it('should deny access to create tags', function(done) {
			request
				.post('/api/tags')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/vpbuilds',      api.anon(api.vpbuilds.list));
		it('should allow to list vpbuilds', function(done) {
			request
				.get('/api/vpbuilds')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		// app.post('/api/vpbuilds',     api.auth(api.vpbuilds.create, 'vpbuilds', 'add'));
		it('should deny access to create vpbuilds', function(done) {
			request
				.post('/api/vpbuilds')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

	});

	describe('for logged clients (role member)', function() {

		/**
		 * {
		 *	roles: 'member',
		 *	allows: [
		 *		{ resources: 'user', permissions: 'profile' },
		 *		{ resources: 'users', permissions: 'view' },
		 *		{ resources: 'files', permissions: 'download' }
		 *	]}
		 */
		it('should deny access to user list', function(done) {
			request
				.get('/api/users')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});
		it('should deny access to user search for less than 3 chars', function(done) {
			request
				.get('/api/users?q=12')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request
				.get('/api/users?q=123')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should only return minmal user info when searching other users', function(done) {
			request
				.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should deny access to user update', function(done) {
			request
				.put('/api/users/1234567890abcdef')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/api/users/1234567890abcdef')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/api/user')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to roles list', function(done) {
			request
				.get('/api/roles')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to ipdb query', function(done) {
			request
				.get('/api/ipdb/4441')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.post('/api/files')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		// app.delete('/api/files/:id',  api.auth(api.files.delete, 'files', 'delete'));
		it('should allow access to file deletion', function(done) {
			request
				.del('/api/files/123456789')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/api/games/mb')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should deny access to game creation', function(done) {
			request
				.post('/api/games')
				.send({})
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/api/ping')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to list tags', function(done) {
			request
				.get('/api/tags')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create tags', function(done) {
			request
				.post('/api/tags')
				.send({})
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow to list vpbuilds', function(done) {
			request
				.get('/api/vpbuilds')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create vpbuilds', function(done) {
			request
				.post('/api/vpbuilds')
				.as('member')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

	});

	describe('for members with the `contributor` role', function() {

		/**
		 * {
		 *	roles: 'contributor',
		 *	allows: [
		 *		{ resources: 'games', permissions: [ 'edit', 'add' ]},
		 *		{ resources: 'ipdb', permissions: 'view' },
		 *		{ resources: 'files', permissions: 'upload' }
		 *	]}
		 */
		it('should deny access to user list', function(done) {
			request
				.get('/api/users')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});
		it('should deny access to user search for less than 3 chars', function(done) {
			request
				.get('/api/users?q=12')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request
				.get('/api/users?q=123')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should only return minmal user info when searching other users', function(done) {
			request
				.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should deny access to user update', function(done) {
			request
				.put('/api/users/1234567890abcdef')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/api/users/1234567890abcdef')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/api/user')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to roles list', function(done) {
			request
				.get('/api/roles')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ipdb query', function(done) {
			request
				.get('/api/ipdb/4441?dryrun=1')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.post('/api/files')
				.as('contributor')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/api/games/mb')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should allow to create games', function(done) {
			request
				.post('/api/games')
				.send({})
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/api/ping')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to list tags', function(done) {
			request
				.get('/api/tags')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create tags', function(done) {
			request
				.post('/api/tags')
				.send({})
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow to list vpbuilds', function(done) {
			request
				.get('/api/vpbuilds')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create vpbuilds', function(done) {
			request
				.post('/api/vpbuilds')
				.as('contributor')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

	});

	describe('for administrators', function() {

		/**
		 * {
		 *	roles: 'admin',
		 *	allows: [
		 *		{ resources: 'users', permissions: [ 'list', 'update' ] },
		 *		{ resources: 'users', permissions: 'update' },
		 *		{ resources: 'roles', permissions: '*' }
		 *	] }
		 */
		it('should allow to list users', function(done) {
			request
				.get('/api/users')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should allow access to user search for less than 3 chars', function(done) {
			request
				.get('/api/users?q=12')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request
				.get('/api/users?q=123')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should allow user update of non-admin', function(done) {
			request
				.put('/api/users/' + hlp.getUser('member').id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should deny user update of admin', function(done) {
			request
				.put('/api/users/' + hlp.getUser('admin2').id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny user update himself', function(done) {
			request
				.put('/api/users/' + hlp.getUser('admin').id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/api/users/1234567890abcdef')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/api/user')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to roles list', function(done) {
			request
				.get('/api/roles')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to ipdb query', function(done) {
			request
				.get('/api/ipdb/4441?dryrun=1')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.post('/api/files')
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/api/games/mb')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should deny to create games', function(done) {
			request
				.post('/api/games')
				.send({})
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/api/ping')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to list tags', function(done) {
			request
				.get('/api/tags')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create tags', function(done) {
			request
				.post('/api/tags')
				.send({})
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow to list vpbuilds', function(done) {
			request
				.get('/api/vpbuilds')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create vpbuilds', function(done) {
			request
				.post('/api/vpbuilds')
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

	});

	describe('for the root user', function() {

		it('should allow to list users', function(done) {
			request
				.get('/api/users')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should allow access to user search for less than 3 chars', function(done) {
			request
				.get('/api/users?q=12')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request
				.get('/api/users?q=123')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});
		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should allow user update of non-admin', function(done) {
			request
				.put('/api/users/' + hlp.getUser('member').id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow user update of admin', function(done) {
			request
				.put('/api/users/' + hlp.getUser('admin').id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow update himself', function(done) {
			request
				.put('/api/users/' + hlp.getUser('root').id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/api/users/1234567890abcdef')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/api/user')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to roles list', function(done) {
			request
				.get('/api/roles')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to ipdb query', function(done) {
			request
				.get('/api/ipdb/4441?dryrun=1')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.post('/api/files')
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/api/games/mb')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should allow to create games', function(done) {
			request
				.post('/api/games')
				.send({})
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/api/ping')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to list tags', function(done) {
			request
				.get('/api/tags')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create tags', function(done) {
			request
				.post('/api/tags')
				.send({})
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow to list vpbuilds', function(done) {
			request
				.get('/api/vpbuilds')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow to create vpbuilds', function(done) {
			request
				.post('/api/vpbuilds')
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

	});

});