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
		socket.on('produce', data => {
			logger.info('Client %s is a producer:', socket.id, data);
			this._sockets[socket.id].isProducer = true;
			this._sockets[socket.id].width = data.width;
			this._sockets[socket.id].height = data.height;
			this._sockets[socket.id].color = data.color;
			if (data.palette.length > 0) {
				this._sockets[socket.id].palette = data.palette;
			}
			this._subscribers[socket.id] = [];
			_.values(this._sockets).filter(s => !s.isProducer).forEach(s => s.socket.emit('producer', { id: this._sockets[socket.id].id }));
		});
		socket.on('subscribe', id => {
			logger.info('Client %s subscribed to stream %s.', socket.id, id);
			let producer = _.values(this._sockets).find(s => s.id === id && s.isProducer);
			if (!producer) {
				socket.emit('err', { message: 'No such producer with ID "' + id + '".' });
				return;
			}
			if (this._subscribers[producer.socket.id].length === 0) {
				logger.info('First subscriber, starting producer %s.', producer.socket.id);
				producer.socket.emit('resume');
			}

			socket.emit('color', { id: producer.id, color: producer.color });
			if (producer.palette) {
				socket.emit('palette', { id: producer.id, palette: producer.palette });
			}
			socket.emit('dimensions', { id: producer.id, width: producer.width, height: producer.height });
			this._subscribers[producer.socket.id].push(this._sockets[socket.id]);
		});
		socket.on('unsubscribe', id => {
			logger.info('Client %s unsubscribed from stream %s.', socket.id, id);
			let producer = _.values(this._sockets).find(s => s.id === id);
			if (!producer) {
				socket.emit('err', { message: 'No such producer with ID "' + id + '".' });
				return;
			}
			this._subscribers[producer.socket.id] = this._subscribers[producer.socket.id].filter(s => s.id !== socket.id);
			if (this._subscribers[producer.socket.id].length === 0) {
				logger.info('No more subscribers, pausing producer %s.', producer.socket.id);
				producer.socket.emit('pause');
			}
		});
		socket.on('disconnect', () => {
			logger.info('Client %s has disconnected.', socket.id);
			if (this._sockets[socket.id].isProducer) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('stop', { id: this._sockets[socket.id].id }));
				delete this._subscribers[socket.id];
			} else {
				_.keys(this._subscribers).forEach(producerSocketId => {
					const subscribers = this._subscribers[producerSocketId];
					const index = subscribers.indexOf(this._sockets[socket.id]);
					if (index > -1) {
						subscribers.splice(index, 1);
					}
					if (this._subscribers[producerSocketId].length === 0) {
						logger.info('No more subscribers for producer %s, pausing.', this._sockets[producerSocketId].socket.id);
						this._sockets[producerSocketId].socket.emit('pause');
					}
				});
			}
			delete this._sockets[socket.id];
		});

		// producer API
		socket.on('color', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('color', {
					id: this._sockets[socket.id].id,
					color: data.color
				}));
			}
		});
		socket.on('palette', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('palette', {
					id: this._sockets[socket.id].id,
					palette: data.palette
				}));
			}
		});
		socket.on('clearColor', () => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('clearColor', { id: this._sockets[socket.id].id }));
			}
		});
		socket.on('clearPalette', () => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('clearPalette', { id: this._sockets[socket.id].id }));
			}
		});
		socket.on('gray2planes', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('gray2planes', {
					id: this._sockets[socket.id].id,
					timestamp: data.readUInt32LE(0),
					planes: data.slice(8)
				}));
			}
		});
		socket.on('gray4planes', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('gray4planes', {
					id: this._sockets[socket.id].id,
					timestamp: data.readUInt32LE(0),
					planes: data.slice(8)
				}));
			}
		});
		socket.on('coloredgray2', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('coloredgray2', {
					id: this._sockets[socket.id].id,
					timestamp: data.readUInt32LE(0),
					palette: readPalette(data, 8, 4),
					planes: data.slice(20)
				}));
			}
		});
		socket.on('coloredgray4', data => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('coloredgray4', {
					id: this._sockets[socket.id].id,
					timestamp: data.readUInt32LE(0),
					palette: readPalette(data, 8, 16),
					planes: data.slice(56)
				}));
			}
		});
		socket.on('stop', () => {
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('stop', { id: this._sockets[socket.id].id }));
			}
		});
		socket.on('dimensions', data => {
			logger.info('New dimensions for client %s:', socket.id, data);
			this._sockets[socket.id].width = data.width;
			this._sockets[socket.id].height = data.height;
			if (this._subscribers[socket.id]) {
				this._subscribers[socket.id].forEach(s => s.socket.emit('dimensions', { id: this._sockets[socket.id].id, width: data.width, height: data.height }));
			}
		});

		// consumer API
		socket.on('getProducers', () => {
			socket.emit('producers', _.values(this._sockets).filter(s => s.isProducer).map(s => s.id));
		});
	}
}
module.exports = new DmdStream();

function readPalette(data, offset, numColors) {
	let palette = [];
	let pos = offset;
	for (var i = 0; i < numColors; i++) {
		palette.push((data.readUInt8(pos) << 16) + (data.readUInt8(pos + 1) << 8) + data.readUInt8(pos + 2));
		pos += 3;
	}
	return palette;
}