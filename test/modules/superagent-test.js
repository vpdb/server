"use strict";

module.exports = function(superagent, options) {

	options = options || {};
	options.schema = options.schema || process.env.HTTP_SCHEMA || 'http';
	options.host = options.host || process.env.HOST || 'localhost';
	options.port = options.port || process.env.PORT || 7357;
	options.authHeader = options.authHeader || process.env.AUTH_HEADER || 'Authorization';

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

};