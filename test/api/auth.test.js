"use strict"; /*global describe, before, after, it*/

var ent = require('ent');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when authenticating with a third-party site', function() {

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
						_raw: '(not mocked)',
						_json: { not: 'mocked '}
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
