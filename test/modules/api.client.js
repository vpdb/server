const util = require('util');
const axios = require('axios');
const faker = require('faker');
const randomstring = require('randomstring');
const assign = require('lodash').assign;
const pick = require('lodash').pick;
const keys = require('lodash').keys;

const ApiClientResult = require('./api.client.result');

class ApiClient {

	constructor(opts) {

		opts = opts || {};

		this._users = new Map();
		this._tokens = new Map();
		this._tearDown = [];

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

		/**
		 * The configuration object for the next request.
		 * Reset after each request.
		 *
		 * @property {string} url Server URL that will be used for the request
		 * @property {string} method Request method to be used when making the request
		 * @property {string} [baseURL] Will be prepended to `url` unless `url` is absolute.
		 * @property {function} [transformRequest] Allows changes to the request data before it is sent to the server.
		 * @property {function} [transformResponse] Allows changes to the response data to be made before it is passed to then/catch
		 * @property {Object<string, string>} [headers] Custom headers to be sent
		 * @property {Object<string, string>} [params] URL parameters to be sent with the request
		 * @property {function} [paramsSerializer] Optional function in charge of serializing `params`
		 * @property {mixed} [data] Data to be sent as the request body
		 * @property {number} [timeout] Number of milliseconds before the request times out.
		 * @property {boolean} [withCredentials] Indicates whether or not cross-site Access-Control requests should be made using credentials
		 * @property {function} [adapter] Allows custom handling of requests which makes testing easier.
		 * @property {Object} [auth] indicates that HTTP Basic auth should be used, and supplies credentials.
		 * @property {string} [auth.username] Username
		 * @property {string} [auth.password] Password
		 * @property {"arraybuffer"|"blob"|"document"|"json"|"text"|"stream"} [responseType] Indicates the type of data that the server will respond with
		 * @property {string} [xsrfCookieName] The name of the cookie to use as a value for xsrf token
		 * @property {string} [xsrfHeaderName] The name of the http header that carries the xsrf token value
		 * @property {function} [onUploadProgress] Allows handling of progress events for uploads
		 * @property {function} [onDownloadProgress] Allows handling of progress events for downloads
		 * @property {number} [maxContentLength] Defines the max size of the http response content allowed
		 * @property {function} [validateStatus] Defines whether to resolve or reject the promise for a given HTTP response status code
		 * @property {number} [maxRedirects] Defines the maximum number of redirects to follow in node.js.
		 * @property {string} [socketPath] Defines a UNIX Socket to be used in node.js
		 * @property {string} [httpAgent] Define a custom agent to be used when performing http requests
		 * @property {string} [httpsAgent] Define a custom agent to be used when performing https requests
		 * @property {Object} [proxy] Defines the hostname and port of the proxy server
		 * @property {CancelToken} [cancelToken] Specifies a cancel token that can be used to cancel the request
		 * @private
		 */
		this._config = {};
		this._baseConfig = {
			baseURL: scheme + '://' + host + ':' + port + path,
			validateStatus: status => status >= 200
		};
		this.api = axios.create();
	}

	/**
	 * Creates a bunch of users.
	 *
	 * Note that this must be run when there's no user in the database, i.e.
	 * after {@link teardownUsers} has been run.
	 *
	 * @param  {Object.<string, Object>} [users] Users with name and attributes
	 * @return {Promise<void>}
	 */
	async setupUsers(users) {

		// create root user first
		await this.createUser('__root', { name: 'root', email: 'root@vpdb.io', roles: ['root', 'mocha' ] });

		// create other users
		for (let key of keys(users || {})) {
			await this.createUser(key, users[key])
		}
	}

	getUser(user) {
		if (!this._users.has(user)) {
			throw Error('User "' + user + '" has not been created.');
		}
		return this._users.get(user);
	}

	getToken(user) {
		if (!this._tokens.has(user)) {
			throw Error('No available token for user "' + user + '".');
		}
		return this._tokens.get(user);
	}

	/**
	 * Uses the root user token to authenticate.
	 * @return {ApiClient}
	 */
	asRoot() {
		return this.as('__root');
	}

	/**
	 * Use the authentication token of given user.
	 *
	 * The user must have been created with either {@link #setupUsers} or
	 * {@link createUser}.
	 *
	 * @param user Reference to user
	 * @return {ApiClient}
	 */
	as(user) {
		if (!this._users.has(user)) {
			throw new Error('User "' + user + '" has not been created ([ ' + Array.from(this._users.keys()).join(', ') + ' ]).');
		}
		if (!this._tokens.has(user)) {
			throw new Error('No token or user "' + user + '".');
		}
		return this.withToken(this._tokens.get(user));
	}

	/**
	 * Use the given token as authentication bearer token.
	 * @param {string} token Token
	 * @returns {ApiClient}
	 */
	withToken(token) {
		return this.withHeader(this._authHeader, 'Bearer ' + token);
	}

	/**
	 * Adds a custom header to the request.
	 * @param {string} name Name of the header
	 * @param {string} value Value
	 * @return {ApiClient}
	 */
	withHeader(name, value) {
		if (!this._config.headers) {
			this._config.headers = {};
		}
		this._config.headers[name] = value;
		return this;
	}

	/**
	 * Saves the response to the documentation folder.
	 * @param {Object} opts Options
	 * @param {Object} opts.path Where to save the response
	 * @return {ApiClient}
	 */
	saveResponse(opts) {
		return this;
	}

	/**
	 * Saves request and response to the documentation folder.
	 * @param {Object} opts Options
	 * @param {Object} opts.path Where to save the response
	 * @return {ApiClient}
	 */
	save(opts) {
		return this;
	}

	/**
	 * Posts a resource to the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @param {Object} data Request body
	 * @returns {Promise<ApiClientResult>}
	 */
	async post(path, data) {
		return await this._request({
			url: path,
			method: 'post',
			data: data
		});
	}

	/**
	 * Gets a resource from the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @returns {Promise<ApiClientResult>}
	 */
	async get(path) {
		return await this._request({
			url: path,
			method: 'get',
		});
	}

	/**
	 * Puts a resource to the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @param {Object} data Request body
	 * @returns {Promise<ApiClientResult>}
	 */
	async put(path, data) {
		return await this._request({
			url: path,
			method: 'put',
			data: data
		});
	}

	/**
	 * Patches a resource at the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @param {Object} data Request body
	 * @returns {Promise<ApiClientResult>}
	 */
	async patch(path, data) {
		return await this._request({
			url: path,
			method: 'patch',
			data: data
		});
	}

	/**
	 * Deletes a resource at the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @returns {Promise<ApiClientResult>}
	 */
	async del(path) {
		return await this._request({
			url: path,
			method: 'delete',
		});
	}

	/**
	 * Gets the response headers from a resource at the VPDB backend.
	 * @param {string} path API path, usually starting with "/v1/..."
	 * @returns {Promise<ApiClientResult>}
	 */
	async head(path) {
		return await this._request({
			url: path,
			method: 'head',
		});
	}

	/**
	 * Deletes are previously entities marked as tear down.
	 * @return {Promise<void>}
	 */
	async teardown() {
		for (let path of this._tearDown.reverse()) {
			await this.asRoot().del(path, 204);
		}
		this._users.clear();
		this._tokens.clear();
	}

	/**
	 * Creates a user to be deleted on teardown.
	 *
	 * Username, mail and password are randomly generated.
	 *
	 * @param {string} name User reference
	 * @param {Object} [attrs] User attributes to set
	 * @param {string} [attrs.name] Username
	 * @param {string} [attrs.email] Email
	 * @param {boolean} [attrs.is_active] If user is active
	 * @param {string[]} [attrs.roles] User roles
	 * @param {string} [attrs._plan] User roles
	 * @param {Object} [opts] Options
	 * @param {boolean} [opts.keepUnconfirmed] If set, user will stay with unconfirmed email and no auth token will be available
	 * @return {Promise<*>} Created user
	 */
	async createUser(name, attrs, opts) {

		attrs = attrs || {};
		opts = opts || {};

		let user = this._generateUser(attrs);
		user.skipEmailConfirmation = !opts.keepUnconfirmed;

		// 1. create user
		let res = await this.post('/v1/users', user, 201);
		user = assign(user, res.data);
		this._users.set(name, assign(user, { _plan: user.plan.id }));
		this.tearDownUser(user.id);

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

	/**
	 * Creates a OAuth user to be deleted on teardown.
	 *
	 * @param {string} name User reference
	 * @param {string} provider Provider ID. Must be one of the configured OAuth providers, currently: [ "github", "ipbtest" ].
	 * @param {Object} [attrs] User attributes to set
	 * @param {string} [attrs.name] Username
	 * @param {string} [attrs.emails] List of email addresses
	 * @param {string[]} [attrs.roles] User roles
	 * @param {string} [attrs._plan] User roles
	 * @return {Promise<*>} Created user
	 */
	async createOAuthUser(name, provider, attrs) {

		// 1. create user
		let user = this._generateOAuthUser(attrs, provider);

		let res = await this.post('/v1/authenticate/mock', user, 200);
		user = assign(user, res.data.user);
		this._users.set(name, assign(user, { _plan: user.plan.id }));
		this._tokens.set(name, res.data.token);
		this.tearDownUser(user.id);

		// 2. update user
		user = assign(user, attrs);
		await this.asRoot().put('/v1/users/' + user.id, pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]), 200);

		return user;
	}

	/**
	 * Marks a user to be deleted in teardown.
	 * @param {string} userId User ID
	 */
	tearDownUser(userId) {
		this._tearDown.push('/v1/users/' + userId);
	}

	dump(res, title) {
		if (res.data) {
			console.log('%s (%d): %s', title || 'RESPONSE', res.status, util.inspect(res.body, null, null, true));
		} else {
			console.log('%s: %s', title || 'RESPONSE', util.inspect(res, null, null, true));
		}
	};

	/**
	 * Executes a request with the given config.
	 *
	 * @param requestConfig Request-specific config
	 * @returns {Promise<ApiClientResult>}
	 * @private
	 */
	async _request(requestConfig) {
		const config = {};
		assign(config, this._baseConfig, this._config, requestConfig);
		this._config = {};
		const res = await this.api.request(config);
		return new ApiClientResult(res);
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
	}

	_generateOAuthUser(attrs, provider) {
		attrs = attrs || {};
		const gen = this._generateUser(attrs);
		return {
			provider: provider,
			profile: {
				provider: provider,
				id: Math.floor(Math.random() * 100000),
				displayName: faker.name.firstName() + ' ' + faker.name.lastName(),
				username: attrs.name || gen.username,
				profileUrl: 'https://' + provider + '.com/' + gen.username,
				emails: attrs.emails || [ { value: gen.email } ]
			}
		};
	}



}

module.exports = ApiClient;