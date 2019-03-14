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

import { BiffParser } from './biff-parser';
import { logger } from '../common/logger';

export class Binary extends BiffParser {

	public static async load(buffer: Buffer, offset: number = 0): Promise<Binary> {
		const binary = new Binary();
		await binary._load(buffer, offset);
		return binary;
	}

	public static from(data: any): Binary {
		const binary = new Binary();
		Object.assign(binary, data);
		return binary;
	}

	public szName: string;
	public szInternalName: string;
	public szPath: string;
	public cdata: number;
	public pos: number;

	public fromTag(buffer: Buffer, tag: string, offset: number, len: number) {
		switch (tag) {
			case 'NAME': this.szName = this.getString(buffer, len); break;
			case 'INME': this.szInternalName = this.getString(buffer, len); break;
			case 'PATH': this.szPath = this.getString(buffer, len); break;
			case 'SIZE': this.cdata = this.getInt(buffer); break;
			case 'DATA': this.pos = offset; break;
			default: logger.warn(null,'Unknown tag "%s".', tag);
		}
	}

	private async _load(buffer: Buffer, offset: number = 0): Promise<void> {
		const blocks = BiffParser.parseBiff(buffer, offset);
		for (const block of blocks) {
			switch (block.tag) {
				case 'NAME': this.szName = this.parseString(buffer, block, 4); break;
				case 'INME': this.szInternalName = this.parseString(buffer, block, 4); break;
				case 'PATH': this.szPath = this.parseString(buffer, block, 4); break;
				case 'SIZE': this.cdata = this.parseInt(buffer, block); break;
				case 'DATA': this.pos = block.pos; break;
			}
		}
	}
}
