'use strict';
/*global describe, before, after, beforeEach, afterEach, it*/

const ApiClient = require('../../test/modules/api.client');
const api = new ApiClient();

describe('The VPDB API', () => {

	before(async () => {
		await api.setupUsers({
			admin: { roles: ['admin'] },
		});
	});

	after(async () => await api.teardown());

	it('should return a HTTP 415 if anything else than JSON is posted', async () => {
		await api
			.withHeader('Content-Type', 'application/xml')
			.post('/v1/tags', '<tag>lol</tag>')
			.then(res => res.expectError(415, 'the API only talks JSON'));
	});

	it('should return a HTTP 400 if the JSON payload from the client is not parsable', async () => {
		await api
			.withHeader('Content-Type', 'application/json')
			.post('/v1/tags', '{')
			.then(res => res.expectStatus(400).expectBody('Parsing error'));
	});

	it('should return a HTTP 404 and a JSON message if the resource is not found', async () => {
		await api.get('/v1/foobar').then(res => res.expectError(404, 'No such resource'));
	});

	it('should return a HTTP 415 if no content-type header is provided', async () => {
		await api
			.withHeader('Content-Type', '')
			.post('/v1/tags', {})
			.then(res => res.expectError(415, 'You need to set the "Content-Type" header'));
	});

});
