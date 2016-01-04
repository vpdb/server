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

"use strict";

var _ = require('lodash');
var util = require('util');
var verr = require('verror');
var logger = require('winston');
var extsprintf = require('extsprintf');

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

	var that = this;
	var log = function() {
		fct(that.toString());

		// also log validation errors; if not desired, launch your log()/warn() before errors().
		if (that.errs) {
			var errs = _.values(that.errs);
			for (var i = 0; i < errs.length; i++) {
				fct(that.name + ': Validation: ' + JSON.stringify(errs[i]));
			}
		}
	};

	if (_.values(args).length) {
		// clone current prefixes
		var prefixes = this.prefixes.slice(0).concat(_.values(args));
		var oldName = this.name;

		this.name = '[' + prefixes.join('|') + ']';
		log();
		this.name = oldName;
	} else {
		log();
	}
};

/**
 * Adds a status code to the error
 * @param {number} code Status code
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

Err.prototype.errors = function(errors) {
	this.errs = errors;
	this._stripFields();
	return this;
};

Err.prototype.without = function(prefix) {
	this.fieldPrefix = prefix;
	this._stripFields();
	return this;
};

Err.prototype._stripFields = function() {
	if (!this.fieldPrefix) {
		return;
	}
	var that = this;
	if (_.isArray(this.errs)) {
		_.each(this.errs, function(error) {
			error.path = error.path.replace(that.fieldPrefix, '');
		});
	} else if (_.isObject(this.errs)) {
		// todo use https://github.com/lodash/lodash/issues/169 when merged
		_.each(this.errs, function(error, path) {
			var newPath = path.replace(that.fieldPrefix, '');
			if (newPath != path) {
				that.errs[newPath] = error;
				delete that.errs[path];
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

	var err = Object.create(Err.prototype);
	Err.apply(err, _.values(arguments));

	var args = this.args || [];
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
	var wrapper = new ErrWrapper(_.values(arguments));
	return ErrWrapper.prototype.error.bind(wrapper);
};