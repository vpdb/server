"use strict";

var fs = require('fs');

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

module.exports = function(superagent, options) {

	options = options || {};
	options.schema = options.schema || process.env.HTTP_SCHEMA || 'http';
	options.host = options.host || process.env.HOST || 'localhost';
	options.port = options.port || process.env.PORT || 7357;
	options.authHeader = options.authHeader || process.env.AUTH_HEADER || 'Authorization';
	options.saveHost = options.saveHost || 'vpdb.ch';
	options.saveRoot = options.saveRoot || 'doc/api/spec';
	options.saveReqHeaders = options.saveReqHeaders || [ 'accept-encoding', 'content-length', 'content-type' ];
	options.saveResHeaders = options.saveResHeaders || [ 'content-length' ];

	var Request = superagent.Request;

	//console.log('Initializing super agent with server %s://%s:%s/\n', options.schema, options.host, options.port);

	var oldRequest = Request.prototype.request;

	Request.prototype.request = function () {
		this.request = oldRequest;
		if (this.url[0] === '/') {
			this.url = options.schema + '://' + options.host + ':' + options.port + this.url;
		}
		return this.request();
	};

	var oldCallback = Request.prototype.callback;

	// automatic doc request/response generation
	Request.prototype.callback = function() {
		this.callback = oldCallback;
		var dest, dump, headers, i;
		if (this._saveReq) {
			dest = options.saveRoot + '/' + this._saveReq.path + '-req.json';
			dump = this.req.method + ' ' + this.req.path + ' HTTP/1.1\r\n';
			headers = this._saveReq.headers || options.saveReqHeaders;
			dump += 'Host: ' + options.saveHost + '\r\n';
			for (i = 0; i < headers.length; i++) {
				if (this.req._headers[headers[i]]) {
					dump += this.req._headerNames[headers[i]] + ': ' + this.req._headers[headers[i]] + '\r\n';
				}
			}
			dump += '\r\n';
			if (this._data) {
				dump += JSON.stringify(this._data, null, '  ');
			}
			fs.writeFileSync(dest, dump);
			delete this._saveReq;
		}
		if (this._saveRes) {
			dest = options.saveRoot + '/' + this._saveRes.path + '-res-' + this.res.statusCode + '.json';
			dump = this.res.statusCode + ' ' + statusMessage[this.res.statusCode] + '\r\n';
			headers = this._saveRes.headers || options.saveResHeaders;
			for (i = 0; i < headers.length; i++) {
				if (this.req._headers[headers[i]]) {
					dump += headers[i].replace(/-(.)|^(.)/g, uppercase) + ': ' + this.req._headers[headers[i]] + '\r\n';
				}
			}
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

	Request.prototype.save = function(opts) {
		this.saveRequest(opts);
		this.saveResponse(opts);
		return this;
	};

	Request.prototype.saveRequest = function(opts) {
		this._saveReq = opts;
		return this;
	};

	Request.prototype.saveResponse = function(opts) {
		this._saveRes = opts;
		return this;
	};
};

function uppercase(m) {
	return m.toUpperCase();
}