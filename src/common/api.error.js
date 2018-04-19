const { format } = require('util');
const { isArray, isObject, forEach, compact } = require('lodash');

class ApiError extends Error {

	constructor() {
		super();
		this.message = format.apply(null, arguments);
		this.statusCode = 0;
		this.logLevel = null; // don't log per default
	}

	/**
	 * Sets the HTTP status.
	 * @param {number} status HTTP status
	 * @returns {ApiError}
	 */
	status(status) {
		this.statusCode = status;
		return this;
	}

	/**
	 * Don't return original message but this (original message gets logged).
	 * @param {string} message Response message
	 * @returns {ApiError}
	 */
	display(message) {
		this.responseMessage = message;
		return this;
	}

	/**
	 * Logs a warning instead of an error.
	 * @return {ApiError}
	 */
	warn() {
		this.logLevel = 'warn';
		return this;
	}

	/**
	 * Logs the error as error.
	 * @return {ApiError}
	 */
	log() {
		this.logLevel = 'error';
		return this;
	}

	/**
	 * Adds a validation error and sets the status to 422.
	 * @param {string} path Path to the invalid field
	 * @param {string} message Error message
	 * @param {*} [value] Invalid value
	 * @returns {ApiError}
	 */
	validationError(path, message, value) {
		this.errs = this.errs || [];
		this.errs.push({ path: path, message: message, value: value });
		this.statusCode = 422;
		this._stripFields();
		return this;
	};

	validationErrors(errs) {
		this.errs = errs;
		this.statusCode = 422;
		this._stripFields();
		return this;
	}

	_stripFields() {
		if (!this.fieldPrefix) {
			return;
		}
		if (isArray(this.errs)) {
			let map = new Map();
			this.errs = compact(this.errs.map(error => {
				error.path = error.path.replace(this.fieldPrefix, '');
				let key = error.path + '|' + error.message + '|' + error.value;
				// eliminate dupes
				if (map.has(key)) {
					return null;
				}
				map.set(key, true);
				return error;
			}));

		} else if (isObject(this.errs)) {
			// todo use https://github.com/lodash/lodash/issues/169 when merged
			forEach(this.errs, (error, path) => {
				const newPath = path.replace(this.fieldPrefix, '');
				if (newPath !== path) {
					this.errs[newPath] = error;
					delete this.errs[path];
				}
			});
		}
	};
}

module.exports = ApiError;