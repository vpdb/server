"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB API', function() {

		it('should return a HTTP 415 if anything else than JSON is posted', function(done) {
			request
				.post('/api/v1/tags')
				.set('Content-Type', 'application/xml')
				.send('<tag>lol</tag>')
				.end(hlp.status(415, 'the API only talks JSON', done));
		});

		it('should return a HTTP 400 if the JSON payload from the client is not parseable', function(done) {
			request
				.post('/api/v1/tags')
				.set('Content-Type', 'application/json')
				.send('{')
				.end(hlp.status(400, 'Parsing error', done));
		});

		it('should return a HTTP 404 and a JSON message if the resource is not found', function(done) {
			request
				.get('/api/v1/foobar')
				.end(hlp.status(404, 'No such resource', done));
		});
});
