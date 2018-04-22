import { format } from 'util';
import { isArray, isObject, forEach, compact } from 'lodash';

export class ApiError extends Error {

	public statusCode: number;
	public body: object;
	private logLevel: string;
	private responseMessage: string;
	private errs: ApiValidationError[];
	private fieldPrefix: string;

	constructor(f?: any, ...param: any[]) {
		super(format.apply(null, arguments));
		this.statusCode = 0;
		this.logLevel = null; // don't log per default
	}

	/**
	 * Sets the HTTP status.
	 * @param {number} status HTTP status
	 * @returns {ApiError}
	 */
	status(status: number): ApiError {
		this.statusCode = status;
		return this;
	}

	/**
	 * Don't return original message but this (original message gets logged).
	 * @param {string} message Response message
	 * @returns {ApiError}
	 */
	display(message: string): ApiError {
		this.responseMessage = message;
		return this;
	}

	/**
	 *
	 * @param {object} body
	 * @return {ApiError}
	 */
	data(body:object): ApiError {
		this.body = body;
		return this;
	}

	/**
	 * Logs a warning instead of an error.
	 * @return {ApiError}
	 */
	warn(): ApiError {
		this.logLevel = 'warn';
		return this;
	}

	/**
	 * Logs the error as error.
	 * @return {ApiError}
	 */
	log(): ApiError {
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
	validationError(path:string, message:string, value?:any): ApiError {
		this.errs = this.errs || [];
		this.errs.push({ path: path, message: message, value: value });
		this.statusCode = 422;
		this._stripFields();
		return this;
	};

	validationErrors(errs: ApiValidationError[]) {
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
			throw new Error('Errs is an object and probably should not be.');
			// todo use https://github.com/lodash/lodash/issues/169 when merged
			// forEach(this.errs, (error, path) => {
			// 	const newPath = path.replace(this.fieldPrefix, '');
			// 	if (newPath !== path) {
			// 		this.errs[newPath] = error;
			// 		delete this.errs[path];
			// 	}
			// });
		}
	};
}

export interface ApiValidationError {
	path: string,
	message: string,
	value?: any
}