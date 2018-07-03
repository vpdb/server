'use strict';
/*global describe, before, after, beforeEach, afterEach, it*/
const expect = require('expect.js');

const ApiClient = require('../../test/modules/api.client');
const api = new ApiClient();

let res;
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

	it('should list the API version', async () => {
		res = await api
			.get('/v1')
			.then(res => res.expectStatus(200));
		expect(res.data.app_name).to.be.ok();
		expect(res.data.app_version).to.be.ok();
	});

	it('should list all plans', async () => {
		res = await api
			.get('/v1/plans')
			.then(res => res.expectStatus(200));
		expect(res.data.length).to.be(4);
	});

	it('should list all roles', async () => {
		res = await api
			.as('admin')
			.get('/v1/roles')
			.then(res => res.expectStatus(200));
		const roles = res.data;
		expect(roles.length).to.be(8);
	});
});
