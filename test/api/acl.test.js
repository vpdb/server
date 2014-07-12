var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request, {
	host: 'localhost',
	port: 3000,
	path: '/api',
	authHeader: 'Authorization'
});

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
				.get('/users')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.put('/api/users/:id',     api.auth(api.users.update, 'users', 'update'));
		it('should deny access to user update', function(done) {
			request
				.put('/users/1234567890abcdef')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.delete('/api/users/:id',  api.auth(api.users.delete, 'users', 'delete'));
		it('should deny access to user delete', function(done) {
			request
				.del('/users/1234567890abcdef')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/user',          api.auth(api.users.profile, 'user', 'profile'));
		it('should deny access to user profile', function(done) {
			request
				.get('/user')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/roles',         api.auth(api.roles.list, 'roles', 'list'));
		it('should deny access to roles list', function(done) {
			request
				.get('/roles')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/ipdb/:id',      api.auth(api.ipdb.view, 'ipdb', 'view'));
		it('should deny access to ipdb query', function(done) {
			request
				.get('/ipdb/4441')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.put('/api/files',         api.auth(api.files.upload, 'files', 'upload'));
		it('should deny access to file upload', function(done) {
			request
				.put('/files')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.head('/api/games/:id',    api.anon(api.games.head));
		it('should allow check for existing games', function(done) {
			request
				.head('/games/mb')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		// app.post('/api/games',        api.auth(api.games.create, 'games', 'add'));
		it('should deny access to game creation', function(done) {
			request
				.post('/games')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		// app.get('/api/ping',          api.anon(api.ping));
		it('should allow access to ping', function(done) {
			request
				.get('/ping')
				.end(function(err, res) {
					expect(res.status).to.be(200);
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
				.get('/users')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user update', function(done) {
			request
				.put('/users/1234567890abcdef')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/users/1234567890abcdef')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/user')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to roles list', function(done) {
			request
				.get('/roles')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to ipdb query', function(done) {
			request
				.get('/ipdb/4441')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to file upload', function(done) {
			request
				.put('/files')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/games/mb')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should deny access to game creation', function(done) {
			request
				.post('/games')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/ping')
				.as('member')
				.end(function(err, res) {
					expect(res.status).to.be(200);
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
				.get('/users')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user update', function(done) {
			request
				.put('/users/1234567890abcdef')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/users/1234567890abcdef')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/user')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to roles list', function(done) {
			request
				.get('/roles')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ipdb query', function(done) {
			request
				.get('/ipdb/4441?dryrun=1')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.put('/files')
				.as('contributor')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/games/mb')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should allow to create games', function(done) {
			request
				.post('/games')
				.as('contributor')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/ping')
				.as('contributor')
				.end(function(err, res) {
					expect(res.status).to.be(200);
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
				.get('/users')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow user update of non-admin', function(done) {
			request
				.put('/users/' + hlp.getUser('member')._id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should deny user update of admin', function(done) {
			request
				.put('/users/' + hlp.getUser('admin2')._id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny user update himself', function(done) {
			request
				.put('/users/' + hlp.getUser('admin')._id)
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/users/1234567890abcdef')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/user')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to roles list', function(done) {
			request
				.get('/roles')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should deny access to ipdb query', function(done) {
			request
				.get('/ipdb/4441?dryrun=1')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should deny access to file upload', function(done) {
			request
				.put('/files')
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/games/mb')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should deny to create games', function(done) {
			request
				.post('/games')
				.as('admin')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/ping')
				.as('admin')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

	});

	describe('for the root user', function() {

		it('should allow to list users', function(done) {
			request
				.get('/users')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow user update of non-admin', function(done) {
			request
				.put('/users/' + hlp.getUser('member')._id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow user update of admin', function(done) {
			request
				.put('/users/' + hlp.getUser('admin')._id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow update himself', function(done) {
			request
				.put('/users/' + hlp.getUser('root')._id)
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should deny access to user delete', function(done) {
			request
				.del('/users/1234567890abcdef')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(403);
					done();
				});
		});

		it('should allow access to user profile', function(done) {
			request
				.get('/user')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to roles list', function(done) {
			request
				.get('/roles')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to ipdb query', function(done) {
			request
				.get('/ipdb/4441?dryrun=1')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

		it('should allow access to file upload', function(done) {
			request
				.put('/files')
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow check for existing games', function(done) {
			request
				.head('/games/mb')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(404);
					done();
				});
		});

		it('should allow to create games', function(done) {
			request
				.post('/games')
				.as('root')
				.send({})
				.end(function(err, res) {
					expect(res.status).to.be(422);
					done();
				});
		});

		it('should allow access to ping', function(done) {
			request
				.get('/ping')
				.as('root')
				.end(function(err, res) {
					expect(res.status).to.be(200);
					done();
				});
		});

	});

});