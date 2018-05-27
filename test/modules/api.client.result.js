const isString = require('lodash').isString;
const isArray = require('lodash').isArray;

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
		this.status = response.status;
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
			console.log(this._logResponse());
			throw new Error('Expected status ' + status + ' but received "' + this.response.status + ' ' + this.response.statusText + '".');
		}
		return this;
	}

	/**
	 * Expects that the returned error message contains a given string.
	 * Note that the check is case-insensitive.
	 * @param {number} status Status code
	 * @param {string} [contains] String that must be present in the error message
	 * @return {ApiClientResult}
	 */
	expectError(status, contains) {
		this.expectStatus(status);
		if (!this.response.data) {
			console.log(this._logResponse());
			throw new Error('Expected data for error validation');
		}
		if (!this.response.data.error) {
			console.log(this._logResponse());
			throw new Error('Expected `error` property in returned object but got ' + JSON.stringify(this.response.data) + '.');
		}
		if (!isString(this.response.data.error) && !isString(this.response.data.error.message)) {
			console.log(this._logResponse());
			throw new Error('Expected `error` property in returned object to be a string or an object containing `message`.');
		}
		const message = isString(this.response.data.error) ? this.response.data.error : this.response.data.error.message;
		if (contains && !message.toLowerCase().includes(contains.toLowerCase())) {
			console.log(this._logResponse());
			throw new Error('Expected returned error message "' + this.response.data.error + '" to contain "' + contains + '".');
		}
		return this;
	}

	/**
	 * Expects the provided validation errors to be in the response body.
	 *
	 * @param {string[][]} errors Array of <field>, <contains> arrays
	 * @param {number} [numErrors] If provided, the number of validation errors must match.
	 * @return {ApiClientResult}
	 */
	expectValidationErrors(errors, numErrors) {
		for (let i = 0; i < errors.length; i++) {
			this.expectValidationError(errors[i][0], errors[i][1]);
		}
		if (numErrors && this.response.data.errors.length !== numErrors) {
			throw new Error('Expected ' + numErrors + ' validation errors, but got ' + this.response.data.errors.length + '.');
		}
		return this;
	}

	/**
	 * Expects a validation error to be in the response body.
	 *
	 * @param {string} field Field
	 * @param {string} [contains] If provided, message must contain this string
	 * @return {ApiClientResult}
	 */
	expectValidationError(field, contains) {
		this.expectStatus(422);
		if (!isArray(this.response.data.errors)) {
			throw new Error('Expected validation errors as array but got ' + JSON.stringify(this.response.data) + '.');
		}
		const fieldErrors = this.response.data.errors.filter(e => e.field === field);
		if (fieldErrors.length === 0) {
			throw new Error('Expected validation error on field "' + field + '" but got none.');
		}
		if (contains) {
			const matchedErrors = fieldErrors.filter(val => val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1);
			if (matchedErrors.length === 0) {
				throw new Error('Expected validation error on field "' + field + '" to contain "' + contains.toLowerCase() + '".');
			}
		}
		return this;
	}

	/**
	 * Expects a given response header.
	 * @param {string} name Name of the header
	 * @param {string} [contains] If set, must be contained, otherwise the header must just exist
	 * @return {ApiClientResult}
	 */
	expectHeader(name, contains) {
		if (!this.response.headers[name.toLowerCase()]) {
			throw new Error('Expected header "' + name + '" to be present, but got nothing.');
		}
		if (contains && !this.response.headers[name.toLowerCase()].toLowerCase().includes(contains.toLowerCase())) {
			throw new Error('Expected header "' + name.toLowerCase() + '" with value "' + this.response.headers[name.toLowerCase()].toLowerCase() + '" to contain "' + contains.toLowerCase() + '".');
		}
		return this;
	}

	_logResponse() {
		const res = this.response;
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
			err += '\n<-- ' + JSON.stringify(res.data, null, '  ').replace(/\n/g, '\n<-- ');
		}
		err += '\n---\n--- Request config: ' + JSON.stringify(res.config);
		return err;
	}
}


module.exports = ApiClientResult;