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

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').saveResponse({ path: 'users/list' }).end(hlp.status(401, done));
		});

		it('should deny access to user search', function(done) {
			request.get('/api/v1/users?q=123').end(hlp.status(401, done));
		});

		it('should deny access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).saveResponse({ path: 'users/view' }).send({}).end(hlp.status(401, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).saveResponse({ path: 'users/update' }).send({}).end(hlp.status(401, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').saveResponse({ path: 'users/del' }).end(hlp.status(401, done));
		});

		it('should deny access to user profile', function(done) {
			request.get('/api/v1/user').saveResponse({ path: 'user/view' }).end(hlp.status(401, done));
		});

		it('should deny access to user logs', function(done) {
			request.get('/api/v1/user/logs').end(hlp.status(401, done));
		});

		it('should deny updates of user profile', function(done) {
			request.patch('/api/v1/user').send({}).end(hlp.status(401, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').end(hlp.status(401, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441').end(hlp.status(401, done));
		});

		it('should deny access to file upload', function(done) {
			request.post('/storage/v1/files').end(hlp.status(401, done));
		});

		it('should deny access to file deletion', function(done) {
			request.del('/api/v1/files/123456789').end(hlp.status(401, done));
		});

		it('should allow access to file details', function(done) {
			request.get('/api/v1/files/123456789').end(hlp.status(404, 'No such file', done));
		});

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').end(hlp.status(404, done));
		});

		it('should deny access to game creation', function(done) {
			request.post('/api/v1/games').send({}).end(hlp.status(401, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').end(hlp.status(401, done));
		});

		it('should deny access to rom creation', function(done) {
			request.post('/api/v1/games/mb/roms').send({}).end(hlp.status(401, done));
		});

		it('should allow access to rom listing', function(done) {
			request.get('/api/v1/games/mb/roms').end(hlp.status(404, done));
		});

		it('should deny access to game rating creation', function(done) {
			request.post('/api/v1/games/mb/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to game rating modification', function(done) {
			request.put('/api/v1/games/mb/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to game rating retrieval', function(done) {
			request.get('/api/v1/games/mb/rating').end(hlp.status(401, done));
		});

		it('should deny access to rom deletion', function(done) {
			request.del('/api/v1/roms/1234').end(hlp.status(401, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').end(hlp.status(200, done));
		});

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').end(hlp.status(200, done));
		});

		it('should deny access to create tags', function(done) {
			request.post('/api/v1/tags').send({}).end(hlp.status(401, done));
		});

		it('should deny access to delete tags', function(done) {
			request.del('/api/v1/tags/mytag').saveResponse({ path: 'tags/del'}).end(hlp.status(401, done));
		});

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').end(hlp.status(200, done));
		});

		it('should deny access to create builds', function(done) {
			request.post('/api/v1/builds').send({}).end(hlp.status(401, done));
		});

		it('should deny access to delete builds', function(done) {
			request.del('/api/v1/builds/mybuild').saveResponse({ path: 'builds/del'}).end(hlp.status(401, done));
		});

		it('should allow to list releases', function(done) {
			request.get('/api/v1/releases').end(hlp.status(200, done));
		});

		it('should allow access to release details', function(done) {
			request.get('/api/v1/releases/123456').end(hlp.status(404, done));
		});

		it('should deny access to create releases', function(done) {
			request.post('/api/v1/releases').send({}).end(hlp.status(401, done));
		});

		it('should deny access to release deletion', function(done) {
			request.del('/api/v1/releases/123456').saveResponse({ path: 'releases/del' }).end(hlp.status(401, done));
		});

		it('should deny access to release commenting', function(done) {
			request.post('/api/v1/releases/123456/comments').send({}).end(hlp.status(401, done));
		});

		it('should deny access to release rating creation', function(done) {
			request.post('/api/v1/releases/123/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to release rating modification', function(done) {
			request.put('/api/v1/releases/123/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to release rating retrieval', function(done) {
			request.get('/api/v1/releases/123/rating').end(hlp.status(401, done));
		});


	});

	describe('for logged clients (role member)', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').as('member').saveResponse({ path: 'users/list' }).end(hlp.status(403, done));
		});

		it('should deny access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('member').end(hlp.status(403, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('member').end(hlp.status(200, done));
		});

		it('should only return minmal user info when searching other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('member')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should deny access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).saveResponse({ path: 'users/view' }).as('member').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('member').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').saveResponse({ path: 'users/del' }).as('member').end(hlp.status(403, done));
		});

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').save({ path: 'user/view' }).as('member').end(hlp.status(200, done));
		});

		it('should allow access to user logs', function(done) {
			request.get('/api/v1/user/logs').as('member').end(hlp.status(200, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').as('member').end(hlp.status(403, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441').as('member').end(hlp.status(403, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('member').end(hlp.status(422, done));
		});

		it('should allow access to file deletion', function(done) {
			request.del('/api/v1/files/123456789').as('member').end(hlp.status(404, done));
		});

		it('should allow access to file details', function(done) {
			request.get('/api/v1/files/123456789').as('member').end(hlp.status(404, done));
		});

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('member').end(hlp.status(404, done));
		});

		it('should deny access to game creation', function(done) {
			request.post('/api/v1/games').send({}).as('member').end(hlp.status(403, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').as('member').end(hlp.status(403, done));
		});

		it('should allow access to rom creation', function(done) {
			request.post('/api/v1/games/mb/roms').as('member').send({}).end(hlp.status(404, done));
		});

		it('should allow access to rom listing', function(done) {
			request.get('/api/v1/games/mb/roms').as('member').end(hlp.status(404, done));
		});

		it('should allow access to game rating creation', function(done) {
			request.post('/api/v1/games/mb/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to game rating modification', function(done) {
			request.put('/api/v1/games/mb/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to game rating retrieval', function(done) {
			request.get('/api/v1/games/mb/rating').as('member').end(hlp.status(404, done));
		});

		it('should allow access to rom deletion', function(done) {
			request.del('/api/v1/roms/1234').as('member').end(hlp.status(404, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('member').end(hlp.status(200, done));
		});

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('member').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('member').end(hlp.status(422, done));
		});

		it('should allow access to tag deletion', function(done) {
			request.del('/api/v1/tags/mytag').as('member').end(hlp.status(404, done));
		});

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('member').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('member').send({}).end(hlp.status(422, done));
		});

		it('should allow access to builds deletion', function(done) {
			request.del('/api/v1/builds/mybuild').as('member').end(hlp.status(404, done));
		});

		it('should allow to list releases', function(done) {
			request.get('/api/v1/releases').as('member').end(hlp.status(200, done));
		});

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('member').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('member').end(hlp.status(404, done));
		});

		it('should allow access to release commenting', function(done) {
			request.post('/api/v1/releases/123456/comments').as('member').send({}).end(hlp.status(404, done));
		});

		it('should allow access to release rating creation', function(done) {
			request.post('/api/v1/releases/123456/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to release rating modification', function(done) {
			request.put('/api/v1/releases/123456/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to release rating retrieval', function(done) {
			request.get('/api/v1/releases/123456/rating').as('member').end(hlp.status(404, done));
		});

	});

	describe('for members with the `contributor` role', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').as('contributor').end(hlp.status(403, done));
		});

		it('should deny access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('contributor').end(hlp.status(403, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('contributor').end(hlp.status(200, done));
		});

		it('should only return minmal user info when searching other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('contributor')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should deny access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('contributor').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('contributor').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/' + hlp.getUser('member').id).as('contributor').end(hlp.status(403, done));
		});

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').as('contributor').end(hlp.status(403, done));
		});

		it('should allow access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('contributor').end(hlp.status(200, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('contributor').end(hlp.status(404, done));
		});

		it('should allow to create games', function(done) {
			request.post('/api/v1/games').send({}).as('contributor').end(hlp.status(422, done));
		});

		it('should allow to delete a game', function(done) {
			request.del('/api/v1/games/mb').as('contributor').end(hlp.status(404, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('contributor').end(hlp.status(200, done));
		});

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('contributor').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('contributor').end(hlp.status(422, done));
		});

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('contributor').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('contributor').end(hlp.status(404, done));
		});

	});

	describe('for administrators', function() {

		it('should allow to list users', function(done) {
			request.get('/api/v1/users').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('admin').end(hlp.status(200, done));
		});

		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('admin')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should grant access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('admin').send({}).end(hlp.status(200, done));
		});

		it('should allow user update of non-admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('admin').send({}).end(hlp.status(422, done));
		});

		it('should deny user update of admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin2').id).as('admin').send({ email: 'test@vpdb.ch' }).end(hlp.status(403, done));
		});

		it('should deny user update himself', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin').id).as('admin').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').as('admin').end(hlp.status(403, done));
		});

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to roles list', function(done) {
			request.get('/api/v1/roles').as('admin').end(hlp.status(200, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('admin').end(hlp.status(403, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('admin').send({}).end(hlp.status(422, done));
		});

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('admin').end(hlp.status(404, done));
		});

		it('should deny to create games', function(done) {
			request.post('/api/v1/games').send({}).as('admin').end(hlp.status(403, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').as('admin').end(hlp.status(403, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('admin').end(hlp.status(200, done));
		});

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('admin').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('admin').end(hlp.status(422, done));
		});

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('admin').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('admin').send({}).end(hlp.status(422, done));
		});

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('admin').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('admin').end(hlp.status(404, done));
		});

	});

	describe('for the root user', function() {

		it('should allow to list users', function(done) {
			request.get('/api/v1/users').as('root').end(hlp.status(200, done));
		});
		it('should allow access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('root').end(hlp.status(200, done));
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('root').end(hlp.status(200, done));
		});
		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('root')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should grant access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('root').send({}).end(hlp.status(200, done));
		});

		it('should allow user update of non-admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow user update of admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow update himself', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('root').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').as('root').end(hlp.status(403, done));
		});

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('root').end(hlp.status(200, done));
		});

		it('should allow access to roles list', function(done) {
			request.get('/api/v1/roles').as('root').end(hlp.status(200, done));
		});

		it('should allow access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('root').end(hlp.status(200, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('root').end(hlp.status(404, done));
		});

		it('should allow to create games', function(done) {
			request.post('/api/v1/games').send({}).as('root').end(hlp.status(422, done));
		});

		it('should allow to delete a game', function(done) {
			request.del('/api/v1/games/mb').as('root').end(hlp.status(404, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('root').end(hlp.status(200, done));
		});

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('root').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('root').end(hlp.status(422, done));
		});

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('root').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('root').end(hlp.status(404, done));
		});

	});

});