"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB API', function() {

	describe('when authorization is provided in the header', function() {

		it('should grant access to the user profile if the token is valid');

		it('should fail if the authorization header has no type');

		it('should fail if the authorization header has a different type than "Bearer"');

		it('should fail if the token is corrupt or unreadable');
	});

	describe('when authorization is provided in the URL', function() {

		it('should display the user profile');

		it('should fail if the token is corrupt or unreadable');
	});

});
