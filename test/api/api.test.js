"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB API', function() {

		it('should return a HTTP 415 if anything else than JSON is posted');

		it('should return a HTTP 400 if the JSON payload from the client is not parseable');
});
