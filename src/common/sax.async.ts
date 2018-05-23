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

import { createReadStream, ReadStream } from 'fs';
import { EventEmitter } from 'events';
import sax, { createStream } from 'sax';

(sax as any).MAX_BUFFER_LENGTH = 64 * 1024 * 1024;

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
export class Parser extends EventEmitter {
	private filename: string;
	private stack: any[];
	private paused: boolean;
	private readStream:ReadStream;
	private saxStream:any;

	constructor(filename: string) {
		super();
		EventEmitter.call(this);
		this.filename = filename;
		this.stack = [];
		this.paused = false;
	}

	/**
	 * Wraps the emit function so it emits only when not paused
	 * and saves emitted events to a stack otherwise.
	 *
	 * @param name Name of the event
	 * @param data Event parameters
	 * @private
	 */
	_emit(name:string, data:any) {
		if (this.paused) {
			this.stack.push({ name: name, data: data});
		} else {
			this.emit(name, data);
		}
	}

	/**
	 * Starts streaming.
	 *
	 * @param {Boolean} [strict] Whether or not to be a jerk. Default: false.
	 * @param {{ trim: Boolean, normalize: Boolean, lowercase: Boolean, xmlns: Boolean, position: Boolean, strictEntities: Boolean }} [options] Options
	 * @returns {Stream}
	 */
	stream(strict:boolean, options?:any) {
		this.readStream = createReadStream(this.filename);
		return this.readStream.pipe(this.createStream(strict, options));
	}

	/**
	 * Creates an XML stream.
	 *
	 * @param {Boolean} [strict] Whether or not to be a jerk. Default: false.
	 * @param {{ trim: Boolean, normalize: Boolean, lowercase: Boolean, xmlns: Boolean, position: Boolean, strictEntities: Boolean }} [options] Options
	 * @returns {*}
	 */
	createStream(strict:boolean, options?:any) {
		this.saxStream = createStream(strict, options);
		this.saxStream.on('error', (data:any) => this._emit('error', data));
		this.saxStream.on('text', (data:any) => this._emit('text', data));
		this.saxStream.on('doctype', (data:any) => this._emit('doctype', data));
		this.saxStream.on('processinginstruction', (data:any) => this._emit('processinginstruction', data));
		this.saxStream.on('sgmldeclaration', (data:any) => this._emit('sgmldeclaration', data));
		this.saxStream.on('opentagstart', (data:any) => this._emit('opentagstart', data));
		this.saxStream.on('opentag', (data:any) => this._emit('opentag', data));
		this.saxStream.on('closetag', (data:any) => this._emit('closetag', data));
		this.saxStream.on('attribute', (data:any) => this._emit('attribute', data));
		this.saxStream.on('comment', (data:any) => this._emit('comment', data));
		this.saxStream.on('opencdata', (data:any) => this._emit('opencdata', data));
		this.saxStream.on('cdata', (data:any) => this._emit('cdata', data));
		this.saxStream.on('closecdata', (data:any) => this._emit('closecdata', data));
		this.saxStream.on('opennamespace', (data:any) => this._emit('opennamespace', data));
		this.saxStream.on('closenamespace', (data:any) => this._emit('closenamespace', data));
		this.saxStream.on('end', (data:any) => this._emit('end', data));
		this.saxStream.on('ready', (data:any) => this._emit('ready', data));
		this.saxStream.on('noscript', (data:any) => this._emit('noscript', data));
		return this.saxStream;
	}

	/**
	 * Pauses the stream. No further events will be submitted
	 * until {@link #resume()} is called.
	 */
	pause() {
		this.paused = true;
		this.readStream.pause();
	}

	/**
	 * Resumes a paused stream.
	 */
	resume() {
		this.paused = false;
		while (this.stack.length > 0 && !this.paused) {
			let e = this.stack.shift();
			this.emit(e.name, e.data);
		}
		if (this.stack.length === 0) {
			this.readStream.resume();
		}
	};
}