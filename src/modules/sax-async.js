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

var fs  = require('fs');
var sax  = require('sax');
var util  = require('util');
var events = require('events');

sax.MAX_BUFFER_LENGTH = 64 * 1024 * 1024;

/**
 * A wrapper for sax-js that supports pausing and resuming streams.
 *
 * When pausing, the file reader is paused as well. However, since sax-js will
 * continue parsing the current chunk, we buffer subsequent events and emit
 * them when {@link #resume()} is called.
 *
 * @param filename
 * @constructor
 */
function Parser(filename) {
	events.EventEmitter.call(this);
	this.filename = filename;
	this.stack = [];
	this.paused = false;
}
util.inherits(Parser, events.EventEmitter);

/**
 * Wraps the emit function so it emits only when not paused
 * and saves emitted events to a stack otherwise.
 *
 * @param name Name of the event
 * @param data Event parameters
 * @private
 */
Parser.prototype._emit = function(name, data) {
	if (this.paused) {
		this.stack.push({ name: name, data: data});
	} else {
		this.emit(name, data);
	}
};

/**
 * Starts streaming.
 *
 * @param {Boolean} [strict] Whether or not to be a jerk. Default: false.
 * @param {{ trim: Boolean, normalize: Boolean, lowercase: Boolean, xmlns: Boolean, position: Boolean, strictEntities: Boolean }} [options] Options
 * @returns {Stream}
 */
Parser.prototype.stream = function(strict, options) {
	this.readStream = fs.createReadStream(this.filename);
	return this.readStream.pipe(this.createStream(strict, options));
};

/**
 * Creates an XML stream.
 *
 * @param {Boolean} [strict] Whether or not to be a jerk. Default: false.
 * @param {{ trim: Boolean, normalize: Boolean, lowercase: Boolean, xmlns: Boolean, position: Boolean, strictEntities: Boolean }} [options] Options
 * @returns {*}
 */
Parser.prototype.createStream = function(strict, options) {
	this.saxStream = sax.createStream(strict, options);
	this.saxStream.on('error', data => this._emit('error', data));
	this.saxStream.on('text', data => this._emit('text', data));
	this.saxStream.on('doctype', data => this._emit('doctype', data));
	this.saxStream.on('processinginstruction', data => this._emit('processinginstruction', data));
	this.saxStream.on('sgmldeclaration', data => this._emit('sgmldeclaration', data));
	this.saxStream.on('opentagstart', data => this._emit('opentagstart', data));
	this.saxStream.on('opentag', data => this._emit('opentag', data));
	this.saxStream.on('closetag', data => this._emit('closetag', data));
	this.saxStream.on('attribute', data => this._emit('attribute', data));
	this.saxStream.on('comment', data => this._emit('comment', data));
	this.saxStream.on('opencdata', data => this._emit('opencdata', data));
	this.saxStream.on('cdata', data => this._emit('cdata', data));
	this.saxStream.on('closecdata', data => this._emit('closecdata', data));
	this.saxStream.on('opennamespace', data => this._emit('opennamespace', data));
	this.saxStream.on('closenamespace', data => this._emit('closenamespace', data));
	this.saxStream.on('end', data => this._emit('end', data));
	this.saxStream.on('ready', data => this._emit('ready', data));
	this.saxStream.on('noscript', data => this._emit('noscript', data));
	return this.saxStream;
};

/**
 * Pauses the stream. No further events will be submitted
 * until {@link #resume()} is called.
 */
Parser.prototype.pause = function() {
	this.paused = true;
	this.readStream.pause();
};

/**
 * Resumes a paused stream.
 */
Parser.prototype.resume = function() {
	this.paused = false;
	while (this.stack.length > 0 && !this.paused) {
		let e = this.stack.shift();
		this.emit(e.name, e.data);
	}
	if (this.stack.length === 0) {
		this.readStream.resume();
	}
};

module.exports = Parser;