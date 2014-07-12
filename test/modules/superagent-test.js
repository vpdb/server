module.exports = function(superagent, options) {

	options.schema = options.schema || 'http';
	options.host = options.host || 'localhost';
	options.port = options.port || 80;
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
		this.set('Authorization', 'Bearer ' + superagent.tokens[name]);
		return this;
	};

};