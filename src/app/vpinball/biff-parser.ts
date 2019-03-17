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
import { ReadResult } from '../common/ole-doc';

export type OnBiffResult = (buffer: Buffer, tag: string, offset: number, len: number) => Promise<void>;

export interface BiffStreamOptions {
	streamedTags?: string[];
	nestedTags?: { [key: string]: OnBiffResult };
}

export class BiffParser {

	public static stream(callback: OnBiffResult, opts: BiffStreamOptions = {}) {
		let nestedCallback: OnBiffResult = null;
		return async (result: ReadResult) => {
			const data = result.data;
			let len = data.readInt32LE(0);
			let dataResult: Buffer;
			const tag = data.slice(4, 8).toString();
			let relStartPos = 8;
			let relEndPos = -4;

			if (opts.nestedTags && opts.nestedTags[tag]) {
				nestedCallback = opts.nestedTags[tag];
				return len + 4;
			}

			if (opts.streamedTags && opts.streamedTags.includes(tag)) {
				len += data.readInt32LE(8) + 4;
				dataResult = null;
				relStartPos += 4;
				relEndPos -= 4;
			} else {
				dataResult = data.slice(8, 8 + len - 4);
			}

			if (!tag || tag === 'ENDB') {
				if (nestedCallback) {
					nestedCallback = null;
					return len + 4;
				}
				return -1;
			}
			const cb = nestedCallback || callback;
			await cb(dataResult, tag, result.storageOffset + relStartPos, len + relEndPos);
			return len + 4;
		};
	}

	public static async decompress(buffer: Buffer, len: number): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			inflate(buffer.slice(0, len), (err, result) => {
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

	public static bgrToRgb(bgr: number) {
		/* tslint:disable:no-bitwise */
		const r = (bgr & 0xff) << 16;
		const g = bgr & 0xff00;
		const b = (bgr & 0xff0000) >> 16;
		/* tslint:enable:no-bitwise */
		return r + g + b;
	}

	protected getString(buffer: Buffer, len: number): string {
		return buffer.slice(4, len).toString('utf8');
	}

	protected getWideString(buffer: Buffer, len: number): string {
		const chars: number[] = [];
		buffer.slice(4, len).forEach((v, i) => {
			if (i % 2 === 0) {
				chars.push(v);
			}
		});
		return Buffer.from(chars).toString('utf8');
	}

	protected getInt(buffer: Buffer): number {
		return buffer.readInt32LE(0);
	}

	protected getFloat(buffer: Buffer): number {
		return buffer.readFloatLE(0);
	}

	protected getBool(buffer: Buffer): boolean {
		return buffer.readInt32LE(0) > 0;
	}

	protected getUnsignedInt2s(buffer: Buffer, num: number): number[] {
		const intSize = 2;
		const ints: number[] = [];
		for (let i = 0; i < num; i++) {
			ints.push(buffer.readUInt16LE(i * intSize));
		}
		return ints;
	}

	protected getUnsignedInt4s(buffer: Buffer, num: number): number[] {
		const intSize = 4;
		const ints: number[] = [];
		for (let i = 0; i < num; i++) {
			ints.push(buffer.readUInt32LE(i * intSize));
		}
		return ints;
	}
}
