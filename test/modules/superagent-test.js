module.exports = function(superagent, options) {

	options.schema = options.schema || process.env.HTTP_SCHEMA || 'http';
	options.host = options.host || process.env.HOST || 'localhost';
	options.port = options.port || process.env.PORT || 7357;
	options.authHeader = options.authHeader || process.env.AUTH_HEADER || 'Authentication';

	options.path = options.path || '';

	var Request = superagent.Request;

	var oldRequest = Request.prototype.request;
	Request.prototype.request = function () {
		this.request = oldRequest;
		if (this.url[0] === '/') {
			this.url = options.schema + '://' + options.host + ':' + options.port + options.path + this.url;
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