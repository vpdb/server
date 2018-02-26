/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

'use strict';

const _ = require('lodash');
const util = require('util');
const verr = require('verror');
const logger = require('winston');
const extsprintf = require('extsprintf');

/**
 * A wrapper for VError that adds pre-configured logging prefixes.
 *
 * @constructor
 */
function Err() {
	verr.VError.apply(this, _.values(arguments));

	this.prefixes = [];
}
util.inherits(Err, verr.VError);

/**
 * Prints the error as an error.
 * @param {*} [arguments] Zero or more prefixes that will added to the global prefixes
 * @returns {Err}
 */
Err.prototype.log = function() {
	this._log(logger.error, arguments);
	return this;
};

/**
 * Prints the error as a warning.
 * @param {*} [arguments] Zero or more prefixes that will added to the global prefixes
 * @returns {Err}
 */
Err.prototype.warn = function() {
	this._log(logger.warn, arguments);
	return this;
};

/**
 * Prints with additional prefixes if provided.
 *
 * @private
 * @param {function} fct Print function, i.e. `logger.warn`
 * @param {object} args The `arguments` variable of the caller
 * @private
 */
Err.prototype._log = function(fct, args) {

	const that = this;
	const log = function() {
		fct(that.toString());

		// also log validation errors; if not desired, launch your log()/warn() before errors().
		if (that.errs) {
			const errs = _.values(that.errs);
			for (let i = 0; i < errs.length; i++) {
				fct(that.name + ': Validation: ' + JSON.stringify(errs[i]));
			}
		}
	};

	if (_.values(args).length) {
		// clone current prefixes
		const prefixes = this.prefixes.slice(0).concat(_.values(args));
		const oldName = this.name;

		this.name = '[' + prefixes.join('|') + ']';
		log();
		this.name = oldName;
	} else {
		log();
	}
};

/**
 * Adds a status code to the error
 * @param {number} code HTTP status code
 * @returns {Err}
 */
Err.prototype.status = function(code) {
	this.code = code;
	return this;
};

/**
 * Sets the message that is sent to the end user (as opposed to the message logged).
 * @param {*} [arguments] Message to display to the end-user. Supports `sprintf` syntax.
 * @returns {Err}
 */
Err.prototype.display = function() {
	try {
		this.displayMessage = extsprintf.sprintf.apply(null, _.values(arguments));
	} catch (e) {
		this.displayMessage = arguments[0];
	}
	return this;
};

/**
 * Adds an additional `data` property to the returned body for structured info.
 * @param {object} data
 */
Err.prototype.data = function(data) {
	this.data = data;
	return this;
};

/**
 * Doesn't display the cause, only logs it
 * @returns {Err}
 */
Err.prototype.short = function() {
	this.message = this.jse_shortmsg + '.';
	return this;
};

Err.prototype.errors = function(errors) {
	this.errs = errors;
	this.code = 422;
	this._stripFields();
	return this;
};

Err.prototype.validationError = function(path, message, value) {
	this.errs = this.errs || [];
	this.errs.push({ path: path, message: message, value: value });
	this.code = 422;
	this._stripFields();
	return this;
};

Err.prototype.without = function(prefix) {
	this.fieldPrefix = prefix;
	this._stripFields();
	return this;
};

Err.prototype.body = function(body) {
	this.body = body;
	return this;
};

Err.prototype._stripFields = function() {
	if (!this.fieldPrefix) {
		return;
	}
	if (_.isArray(this.errs)) {
		let map = new Map();
		this.errs = _.compact(this.errs.map(error => {
			error.path = error.path.replace(this.fieldPrefix, '');
			let key = error.path + '|' + error.message + '|' + error.value;
			// eliminate dupes
			if (map.has(key)) {
				return null;
			}
			map.set(key, true);
			return error;
		}));

	} else if (_.isObject(this.errs)) {
		// todo use https://github.com/lodash/lodash/issues/169 when merged
		_.forEach(this.errs, (error, path) => {
			const newPath = path.replace(this.fieldPrefix, '');
			if (newPath != path) {
				this.errs[newPath] = error;
				delete this.errs[path];
			}
		});
	}
};

/**
 * Returns the message send to the end user.
 * @returns {string}
 */
Err.prototype.msg = function() {
	return this.displayMessage || this.message;
};


/**
 * The wrapper holds the log prefixes and instantiates {Err} objects with them
 *
 * @param {array} [args] Prefixes
 * @constructor
 */
function ErrWrapper(args) {
	this.args = _.values(args);
}

/**
 * Creates a new error. Same arg as `VError` constructor.
 *
 * @see https://github.com/davepacheco/node-verror
 * @returns {Err}
 */
ErrWrapper.prototype.error = function() {

	const err = Object.create(Err.prototype);
	Err.apply(err, _.values(arguments));

	const args = this.args || [];
	if (args.length > 0) {
		err.prefixes = args;
		err.name = '[' + args.join('|') + ']';
	} else {
		err.name = '[unknown]';
	}
	return err;
};

/**
 * Returns an error factory able to easily instantiate errors.
 *
 * @param {*} [arguments] Zero or more prefixes that will show up in the error log.
 * @returns {ErrWrapper.error}
 */
module.exports = function() {
	const wrapper = new ErrWrapper(_.values(arguments));
	return ErrWrapper.prototype.error.bind(wrapper);
};