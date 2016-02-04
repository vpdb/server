"use strict";

Promise = require('bluebird'); // jshint ignore:line
var _ = require('lodash');
var fs = require('fs');
var argv = require('yargs').argv;

var statusMessage = {
	200: 'OK',
	201: 'Created',
	204: 'No Content',
	304: 'Not Modified',
	400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	422: 'Unprocessable Entity',
	500: 'Internal Server Error'
};

Promise.config({
	// Enable cancellation.
	cancellation: true
});

module.exports = function(superagent, options) {

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

	options = options || {};
	options.scheme = argv.scheme || options.scheme || process.env.HTTP_SCHEME || 'http';
	options.host = argv.host || options.host || process.env.HOST || 'localhost';
	options.port = argv.port || options.port || process.env.PORT || 7357;
	options.authHeader = options.authHeader || process.env.AUTH_HEADER || 'Authorization';
	options.saveHost = options.saveHost || 'vpdb.io';
	options.saveRoot = options.saveRoot || 'doc/api/v1';
	options.ignoreReqHeaders = options.ignoreReqHeaders || ['cookie', 'host', 'user-agent'];
	options.ignoreResHeaders = options.ignoreResHeaders || ['x-token-refresh', 'x-user-dirty', 'vary', 'connection', 'transfer-encoding', 'date'];

	var Request = superagent.Request;

	//console.log('Initializing super agent with server %s://%s:%s/\n', options.scheme, options.host, options.port);

	var oldRequest = Request.prototype.request;

	Request.prototype.request = function() {
		this.request = oldRequest;
		if (this.url[0] === '/') {
			this.url = options.scheme + '://' + options.host + ':' + options.port + this.url;
		}
		return this.request();
	};

	var oldCallback = Request.prototype.callback;

	// automatic doc request/response generation
	Request.prototype.callback = function() {
		this.callback = oldCallback;
		var dest, dump, forceHeaders;
		var that = this;
		if (this._saveReq) {
			dest = saveRoot(options.saveRoot, this._saveReq.path, '-req.json');
			dump = this.req.method + ' ' + this.req.path + ' HTTP/1.1\r\n';
			forceHeaders = this._saveReq.headers || [];
			dump += 'Host: ' + options.saveHost + '\r\n';
			_.each(this.req._headers, function(headerVal, header) {
				if (_.includes(forceHeaders, header) || !_.includes(options.ignoreReqHeaders, header)) {
					dump += that.req._headerNames[header] + ': ' + headerVal + '\r\n';
				}
			});
			dump += '\r\n';
			if (this._data) {
				dump += JSON.stringify(this._data, null, '  ');
			}
			fs.writeFileSync(dest, dump);
			delete this._saveReq;
		}
		if (this._saveRes) {
			dest = saveRoot(options.saveRoot, this._saveRes.path, '-res-' + this.res.statusCode + '.json');
			dump = this.res.statusCode + ' ' + statusMessage[this.res.statusCode] + '\r\n';
			forceHeaders = this._saveRes.headers || [];
			_.each(this.res.headers, function(headerVal, header) {
				if (_.includes(forceHeaders, header) || !_.includes(options.ignoreResHeaders, header)) {
					dump += header.replace(/-(.)|^(.)/g, uppercase) + ': ' + headerVal + '\r\n';
				}
			});
			dump += '\r\n';
			if (this.res.body) {
				dump += JSON.stringify(this.res.body, null, '  ');
			}

			fs.writeFileSync(dest, dump);
			delete this._saveRes;
		}
		return this.callback.apply(this, arguments);
	};

	Request.prototype.as = function(name) {

		if (!name) {
			return this;
		}
		if (!superagent.tokens || !superagent.tokens[name]) {
			throw new Error('Cannot find JWT for role "' + name + '".');
		}
		this.set(options.authHeader, 'Bearer ' + superagent.tokens[name]);
		return this;
	};

	Request.prototype.with = function(token) {
		this.set(options.authHeader, 'Bearer ' + token);
		return this;
	};

	Request.prototype.save = function(opts) {
		this.saveRequest(opts);
		this.saveResponse(opts);
		return this;
	};

	Request.prototype.saveRequest = function(opts) {
		if (_.isString(opts)) {
			opts = { path: opts };
		}
		this._saveReq = opts;
		return this;
	};

	Request.prototype.saveResponse = function(opts) {
		if (_.isString(opts)) {
			opts = { path: opts };
		}
		this._saveRes = opts;
		return this;
	};

	/**
	 * Adds promise support for superagent/supertest
	 *
	 * Call .promise() to return promise for the request
	 *
	 * @method then
	 * @return {Promise}
	 */
	Request.prototype.promise = function() {
		var req = this;
		return new Promise((resolve, reject, onCancel) => {
			req.end(function(err, res) {
				if (err && err.status) {
					resolve(err);
				} else if (res) {
					resolve(res);
				} else {
					reject(new Error('Error in request: ' + err.message, err));
				}
			});
			onCancel(function() {
				req.abort();
			});
		});
	};

	/**
	 * Make superagent requests Promises/A+ conformant
	 *
	 * Call .then([onFulfilled], [onRejected]) to register callbacks
	 *
	 * @method then
	 * @param {function} [onFulfilled]
	 * @param {function} [onRejected]
	 * @return {Promise}
	 */
	Request.prototype.then = function() {
		var promise = this.promise();
		return promise.then.apply(promise, arguments);
	};
};

function saveRoot(root, savePath, suffix) {
	var p = savePath.split('/', 2);
	root = root + '/' + p[0] + '/http';
	if (!fs.existsSync(root)) {
		fs.mkdirSync(root);
	}
	return root + '/' + p[1] + suffix;
}

function uppercase(m) {
	return m.toUpperCase();
}