"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB web application', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when accessing the style guide', function() {

		it('should return a HTTP 200 and a HTML page');

	});

	describe('when retrieving a partial as anonymous', function() {

		it('allow access to public partials');

		it('deny access to non-public partials');

	});

	describe('when retrieving a partial as a logged user', function() {

		it('allow access to non-public partials');

	});

});
