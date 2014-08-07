"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var ent = require('ent');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication of the VPDB API', function() {

	describe('when authenticating the first time', function() {

		beforeEach(function(done) {
			hlp.setupUsers(request, {}, done);
		});

		afterEach(function(done) {
			hlp.cleanup(request, done);
		});

		it('should return a valid JWT', function(done) {
			request
				.post('/auth/mock')
				.send({
					profile: {
						provider: 'github',
						id: '11234',
						displayName: null,
						username: 'mockuser',
						profileUrl: 'https://github.com/mockuser',
						emails: [ { value: 'mockuser@vpdb.ch' } ],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					var auth = JSON.parse(ent.decode(res.text.match(/auth="([^"]+)/)[1]));
					var authHeader = res.text.match(/auth-header="([^"]+)/)[1];
					request.get('/api/user').set(authHeader, 'Bearer ' + auth.jwt).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomUser(res.body.id);
						done();
					});
				});
		});

		it('should return a valid JWT', function(done) {
			request
				.post('/auth/mock')
				.send({
					profile: {
						provider: 'vpf',
						id: '2',
						username: 'test',
						displayName: 'test i am',
						profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'test@vpdb.ch' } ],
						photos: [ { value: 'http://localhost:8088/uploads/' } ],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					var auth = JSON.parse(ent.decode(res.text.match(/auth="([^"]+)/)[1]));
					var authHeader = res.text.match(/auth-header="([^"]+)/)[1];
					request.get('/api/user').set(authHeader, 'Bearer ' + auth.jwt).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomUser(res.body.id);
						done();
					});
				});
		});

	});
});
