/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2017 freezy <freezy@xbmc.org>
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

const _ = require('lodash');
const logger = require('winston');
const crypto = require('crypto');

class DmdStream {

	constructor() {
		this._sockets = {};
		this._subscribers = {};
	}

	onNewConnection(socket) {
		logger.info('New Socket.IO client %s connected.', socket.id);
		this._sockets[socket.id] = { socket: socket, id: crypto.randomBytes(16).toString('hex'), isProducer: false };

		// general API
		socket.on('produce', () => {
			logger.info('Client %s is a producer', socket.id);
			this._sockets[socket.id].isProducer = true;
			this._subscribers[socket.id] = [];
		});
		socket.on('subscribe', id => {
			logger.info('Client %s subscribed to stream %s.', socket.id, id);
			let producer = _.values(this._sockets).find(s => s.id === id && s.isProducer);
			if (!producer) {
				socket.emit('error', { message: 'No such producer with ID "' + id + '".' });
				return;
			}
			this._subscribers[producer.socket.id].push(this._sockets[socket.id]);
		});
		socket.on('unsubscribe', id => {
			logger.info('Client %s unsubscribed from stream %s.', socket.id, id);
			let producer = _.values(this._sockets).find(s => s.id === id);
			if (!producer) {
				socket.emit('error', { message: 'No such producer with ID "' + id + '".' });
				return;
			}
			this._subscribers[producer.socket.id] = this._subscribers[producer.socket.id].filter(s => s.id !== socket.id);
		});
		socket.on('disconnect', () => {
			logger.info('Client %s has disconnected.', socket.id);
			if (this._sockets[socket.id].isProducer) {
				delete this._subscribers[socket.id];
			}
			delete this._sockets[socket.id];
		});

		// producer API
		socket.on('gray2frame', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('gray2frame', { id: this._sockets[socket.id].id, frame: data }));
			}
		});

		// consumer API
		socket.on('getProducers', () => {
			socket.emit('producers', _.values(this._sockets).filter(s => s.isProducer).map(s => s.id));
		});

	}
}
module.exports = new DmdStream();
