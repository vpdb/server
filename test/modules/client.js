const axios = require('axios');
const faker = require('faker');
const randomstring = require('randomstring');
const assign = require('lodash').assign;
const pick = require('lodash').pick;
const keys = require('lodash').keys;

class ApiClient {

	constructor(opts) {

		opts = opts || {};

		this._users = new Map();
		this._tokens = new Map();
		this._config = {};

		this.params = null;

		const scheme = opts.scheme || process.env.HTTP_SCHEME || 'http';
		const host = opts.host || process.env.HOST || 'localhost';
		const port = opts.port || process.env.PORT || 7357;
		const path = opts.path || process.env.API_PATH || '/api';

		this._authHeader = opts.authHeader || process.env.AUTH_HEADER || 'Authorization';

		this.saveOpts = {
			host: opts.saveHost || 'api.vpdb.io',
			root: opts.saveRoot || 'doc/api/v1',
			ignoreReqHeaders: opts.ignoreReqHeaders || ['cookie', 'host', 'user-agent'],
			ignoreResHeaders: opts.ignoreResHeaders || ['access-control-allow-origin', 'access-control-expose-headers', 'x-token-refresh', 'x-user-dirty', 'vary', 'connection', 'transfer-encoding', 'date', 'x-app-sha']
		};

		this.api = axios.create({
			baseURL: scheme + '://' + host + ':' + port + path
		});
	}

	async setupUsers(users) {

		// create root user first
		await this.createUser('__root', { roles: ['root', 'mocha' ] });

		// create other users
		keys(users).forEach(async () => {
			await this.createUser(key, users[key])
		});
	}

	as(username) {
		if (!this._users.has(username)) {
			throw new Error('User "' + username + '" has not been created.');
		}
		if (!this._tokens.has(username)) {
			throw new Error('No token or user "' + username + '".');
		}
		this._config.headers = { [this._authHeader]: this._tokens.get(username) };
		return this;
	}

	asRoot() {
		return this.as('__root');
	}

	async post(path, data, expectedStatus, contains) {
		const res = await this.api.post(path, data, this._getConfig());
		if (expectedStatus) {
			if (res.status !== code) {
				console.log(res.data);
			}
			expect(res.status).to.be(code);
			if (contains) {
				expect(res.data.error.toLowerCase()).to.contain(contains.toLowerCase());
			}
		}
		return res;
	}
	async get(path) {

	}
	async put(path) {

	}
	async patch(path) {

	}
	async del(path) {

	}
	async head(path) {

	}

	async teardownUsers() {

	}


	async createUser(name, attrs, opts) {

		attrs = attrs || {};
		opts = opts || {};

		let user = this._generateUser(attrs);
		user.skipEmailConfirmation = !opts.keepUnconfirmed;

		// 1. create user
		let res = await this.post('/v1/users', user, 201);
		user = assign(user, res.data);
		this._users.set(name, assign(user, { _plan: user.plan.id }));

		// can't get token for unconfirmed user
		if (!user.skipEmailConfirmation) {
			return user;
		}

		// 2. retrieve token
		res = await this.post('/v1/authenticate', pick(user, 'username', 'password'), 200);
		this._tokens.set(name, res.data.token);

		// 3. update user
		user = assign(user, attrs);
		await this.asRoot().put('/v1/users/' + user.id, pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]), 200);

		return user;
	}

	async createOAuthUser(user) {

	}

	doomUser(userId) {

	}

	_getConfig() {
		return assign({
			validateStatus: status => status >= 200
		}, this._config);
	}

	_generateUser(attrs) {

		let username = '';
		do {
			username = faker.internet.userName().replace(/[^a-z0-9]+/gi, '');
		} while (username.length < 3);

		return assign({
			username: username,
			password: randomstring.generate(10),
			email: faker.internet.email().toLowerCase()
		}, attrs || {});
	};
}

module.exports = ApiClient;