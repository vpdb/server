/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { inflate } from 'zlib';

export class BiffParser {

	public static stream(streamedTags: string[], callback: (buffer: Buffer, tag: string, len: number) => void) {
		return (data: Buffer) => {
			let len = data.readInt32LE(0);
			let dataResult: Buffer;
			const tag = data.slice(4, 8).toString();
			if (streamedTags.includes(tag)) {
				len += data.readInt32LE(8) + 4;
				dataResult = data.slice(8, 12);
			} else {
				dataResult = data.slice(8, 8 + len - 4);
			}

			if (!tag || tag === 'ENDB') {
				return -1;
			}
			callback(dataResult, tag, len - 4);
			return len + 4;
		};
	}

	/**
	 * Tries to parse the BIFF format and returns all blocks as an array.
	 *
	 * @param {Buffer} buf Buffer to parse
	 * @param {number} [offset=0] Where to start to read
	 * @returns {Block} All BIFF blocks.
	 */
	public static parseBiff(buf: Buffer, offset: number = 0): BiffBlock[] {
		offset = offset || 0;
		let tag: string;
		let blockSize: number;
		let block: Buffer;
		const blocks: BiffBlock[] = [];
		let i = offset;
		try {
			do {
				/* usually, we have:
				 *    4 bytes size of block (blockSize)
				 *    blockSize bytes of data, where data is
				 *        4 bytes tag name
				 *        (blockSize - 4) bytes data
				 */
				blockSize = buf.slice(i, i + 4).readInt32LE(0);  // size of the block excluding the 4 size bytes
				block = buf.slice(i + 4, i + 4 + blockSize);     // contains tag and data
				tag = block.slice(0, 4).toString();
				let counterIncreased = false;

				//noinspection FallthroughInSwitchStatementJS
				switch (tag) {

					// ignored
					case 'FONT':
						/* not hashed, but need to find out how many bytes to skip. best guess: tag
						 * is followed by 8 bytes of whatever, then 2 bytes size BE, followed by
						 * data.
						 */
						blockSize = buf.readInt16BE(i + 17);
						i += 19 + blockSize;
						counterIncreased = true;
						break;

					// streams
					case 'CODE':

						/* in here, the data starts with 4 size bytes again. this is a special case,
						 * what's hashed now is only the tag and the data *after* the 4 size bytes.
						 * concretely, we have:
						 *    4 bytes size of block (blockSize above)
						 *    4 bytes tag name (tag)
						 *    4 bytes size of code (blockSize below)
						 *    n bytes of code (block below)
						 */
						i += 8;
						blockSize = buf.slice(i, i + 4).readInt32LE(0);
						block = buf.slice(i + 4, i + 4 + blockSize);
						block = Buffer.concat([Buffer.from(tag), block]);
						break;
				}

				if (!counterIncreased) {
					if (blockSize >= 4) {
						blocks.push({ tag, pos: i + 8, len: blockSize - 4 });
					}
					i += blockSize + 4;
				}

				//console.log('*** Adding block [%d] %s: %s', blockSize, tag, data && data.length > 100 ? data.slice(0, 100) : data);
				//console.log('*** Adding block [%d] %s', blockSize, block.length > 100 ? block.slice(0, 100) : block);

			} while (i < buf.length - 4);

		} catch (err) {
			// do nothing and return what we have..
		}
		return blocks;
	}

	public static async decompress(buffer: Buffer, block: BiffBlock): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			inflate(buffer.slice(block.pos, block.pos + block.len), (err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public static parseNullTerminatedString(buffer: Buffer, maxLength: number = 0) {
		if (maxLength) {
			buffer = buffer.slice(0, maxLength);
		}
		const nullBuffer = Buffer.from([0x0]);
		if (buffer.indexOf(nullBuffer) >= 0) {
			return buffer.slice(0, buffer.indexOf(nullBuffer)).toString('utf8');
		}
		return buffer.toString('utf8');
	}

	protected parseInt(buffer: Buffer, block: BiffBlock): number {
		return buffer.readInt32LE(block.pos);
	}

	protected parseBool(buffer: Buffer, block: BiffBlock): boolean {
		return buffer.readInt32LE(block.pos) > 0;
	}

	protected parseFloat(buffer: Buffer, block: BiffBlock): number {
		return buffer.readFloatLE(block.pos);
	}

	protected parseString(buffer: Buffer, block: BiffBlock, offset: number = 0): string {
		return buffer.slice(block.pos + offset, block.pos + block.len).toString('utf8');
	}

	protected parseWideString(buffer: Buffer, block: BiffBlock): string {
		const chars: number[] = [];
		buffer.slice(block.pos + 4, block.pos + block.len).forEach((v, i) => {
			if (i % 2 === 0) {
				chars.push(v);
			}
		});
		return Buffer.from(chars).toString('utf8');
	}

	protected parseUnsignedInt2s(buffer: Buffer, block: BiffBlock, num: number): number[] {
		block = block || { pos: 0, len: buffer.length };
		const intSize = 2;
		if (block.len < num * intSize) {
			throw new Error('Cannot parse ' + num * intSize + ' bytes of ' + num + ' unsigned ints with ' + buffer.length + ' bytes of buffer data.');
		}
		const ints: number[] = [];
		for (let i = 0; i < num; i++) {
			ints.push(buffer.readUInt16LE(block.pos + i * intSize));
		}
		return ints;
	}

	protected parseUnsignedInt4s(buffer: Buffer, block: BiffBlock, num: number): number[] {
		const intSize = 4;
		if (block.len < num * intSize) {
			throw new Error('Cannot parse ' + num * intSize + ' bytes of ' + num + ' unsigned ints with ' + buffer.length + ' bytes of buffer data.');
		}
		const ints: number[] = [];
		for (let i = 0; i < num; i++) {
			ints.push(buffer.readUInt32LE(block.pos + i * intSize));
		}
		return ints;
	}
}

export interface BiffBlock {
	tag?: string;
	pos: number;
	len: number;
}
