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

import { BiffBlock } from './biff-parser';
import { logger } from '../common/logger';

export abstract class GameItem {

	public static TypeSurface = 0;
	public static TypeFlipper = 1;
	public static TypeTimer = 2;
	public static TypePlunger = 3;
	public static TypeTextbox = 4;
	public static TypeBumper = 5;
	public static TypeTrigger = 6;
	public static TypeLight = 7;
	public static TypeKicker = 8;
	public static TypeDecal = 9;
	public static TypeGate = 10;
	public static TypeSpinner = 11;
	public static TypeRamp = 12;
	public static TypeTable = 13;
	public static TypeLightCenter = 14;
	public static TypeDragPoint = 15;
	public static TypeCollection = 16;
	public static TypeDispReel = 17;
	public static TypeLightSeq = 18;
	public static TypePrimitive = 19;
	public static TypeFlasher = 20;
	public static TypeRubber = 21;
	public static TypeHitTarget = 22;
	public static TypeCount = 23;
	public static TypeInvalid = 0xffffffff;

	public fLocked: boolean;
	public layerIndex: number;

	public abstract getName(): string;

	protected parseUnknownBlock(block: BiffBlock) {
		switch (block.tag) {
			case 'LOCK': this.fLocked = this.parseBool(block); break;
			case 'LAYR': this.layerIndex = this.parseInt(block); break;
			default:
				logger.warn(null, '[GameItem.parseUnknownBlock]: Unknown block "%s".', block.tag);
				break;
		}
	}

	protected parseInt(block: BiffBlock): number {
		return block.data.readInt32LE(0);
	}

	protected parseBool(block: BiffBlock): boolean {
		return block.data.readInt32LE(0) > 0;
	}

	protected parseFloat(block: BiffBlock): number {
		return block.data.readFloatLE(0);
	}

	protected parseString(block: BiffBlock, offset: number = 0): string {
		return offset > 0
			? block.data.slice(offset).toString('utf8')
			: block.data.toString('utf8');
	}

	protected parseWideString(block: BiffBlock): string {
		const chars: number[] = [];
		block.data.slice(4).forEach((v, i) => {
			if (i % 2 === 0) {
				chars.push(v);
			}
		});
		return Buffer.from(chars).toString('utf8');
	}

	protected parseUnsignedInts(buffer: Buffer, num: number): number[] {
		const intSize = 2;
		if (buffer.length < num * intSize) {
			throw new Error('Cannot parse ' + num * intSize + ' bytes of ' + num + ' unsigned ints with ' + buffer.length + ' bytes of buffer data.');
		}
		const ints: number[] = [];
		for (let i = 0; i < num; i++) {
			ints.push(buffer.readUInt16LE(i * intSize));
		}
		return ints;
	}
}
