class ApiClientResult {

	constructor(response) {
		/**
		 * Response from Axios
		 * @property {Object} data Response that was provided by the server
		 * @property {number} status HTTP status code from the server response
		 * @property {string} statusText HTTP status message from the server response
		 * @property {Object} headers Headers that the server responded
		 * @property {Object} config Config that was provided to `axios` for the request
		 * @property {Object} request The request that generated this response
		 * @private
		 */
		this.response = response;

		/**
		 * Response that was provided by the server
		 * @type {Object}
		 */
		this.data = response.data;
		/**
		 * HTTP status code from the server response
		 * @type {number}
		 */
		this.status = response.data;
		/**
		 * HTTP status message from the server response
		 * @type {string}
		 */
		this.statusText = response.statusText;
		/**
		 * Headers that the server responded
		 * @type {Object}
		 */
		this.headers = response.headers;
		/**
		 * Config that was provided to `axios` for the request
		 * @type {Object}
		 */
		this.config = response.config;
		/**
		 * The request that generated this response
		 * @type {Object}
		 */
		this.request = response.request;
	}

	/**
	 * Asserts that a given HTTP status code was returned.
	 * @param {number} status Status code
	 * @return {ApiClientResult}
	 */
	expectStatus(status) {
		if (this.response.status !== status) {
			console.log(this._logResponse(this.response));
			throw new Error('Expected status ' + status + ' but received "' + this.response.status + ' ' + this.response.statusText + '".');
		}
		return this;
	}

	/**
	 * Expects that the returned error message contains a given string.
	 * Note that the check is case-insensitive.
	 * @param {number} status Status code
	 * @param {string} contains String that must be present in the error message
	 * @return {ApiClientResult}
	 */
	expectError(status, contains) {
		this.expectStatus(status);
		if (!this.response.data) {
			console.log(this._logResponse(this.response));
			throw new Error('Expected data for error validation');
		}
		if (!this.response.data.error) {
			console.log(this._logResponse(this.response));
			throw new Error('Expected `error` property in returned object but got ' + JSON.stringify(this.response.data) + '.');
		}
		if (!this.response.data.error.toLowerCase().includes(contains.toLowerCase())) {
			console.log(this._logResponse(this.response));
			throw new Error('Expected returned error message "' + this.response.data.error + '" to contain "' + contains + '".');
		}
		return this;
	}

	_logResponse(res) {
		let err = '';
		err += '\n--> ' + res.request._header.replace(/\n/g, '\n--> ');
		if (res.config.data) {
			err += '\n--> ' + res.config.data;
		}
		err += '\n<-- ' + res.status + ' ' + res.statusText;
		Object.keys(res.headers).forEach(name => {
			err += '\n<-- ' + name + ' ' + res.headers[name];
		});
		if (res.data) {
			err += '\n<--';
			err += '\n<-- ' + JSON.stringify(res.data, null, '  ').replace(/\n/g, '\n--> ');
		}
		err += '\nRequest config: ' + JSON.stringify(res.config);
		return err;
	}
}


module.exports = ApiClientResult;