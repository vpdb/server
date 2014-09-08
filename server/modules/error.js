/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

	if (_.values(args).length) {
		// clone current prefixes
		var prefixes = this.prefixes.slice(0).concat(_.values(args));
		var oldName = this.name;

		this.name = '[' + prefixes.join('|') + ']';
		fct(this.toString());
		this.name = oldName;
	} else {
		fct(this.toString());
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
	this.displayMessage = extsprintf.sprintf.apply(null, _.values(arguments));
	return this;
};

Err.prototype.errors = function(errors) {
	this.errs = errors;
	return this;
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
	ErrWrapper.prototype.args = _.values(args);
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

	var args = ErrWrapper.prototype.args || [];
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
 * @returns {ErrWrapper}
 */
module.exports = function() {
	return new ErrWrapper(_.values(arguments));
};
