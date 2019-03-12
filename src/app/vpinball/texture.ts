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

import { logger } from '../common/logger';
import { settings } from '../common/settings';
import { BiffParser } from './biff-parser';
import { Binary } from './binary';

export class Texture extends BiffParser {

	public static async load(buffer: Buffer, pos: number): Promise<Texture> {
		const texture = new Texture();
		await texture._load(buffer, pos);
		return texture;
	}

	public static from(data: any): Texture {
		const texture = new Texture();
		Object.assign(texture, data);
		texture.binary = Binary.from(data.binary);
		return texture;
	}

	public storageName: string;
	public szName: string;
	public szInternalName: string;
	public szPath: string;
	public width: number;
	public height: number;
	public alphaTestValue: number;
	public binary: Binary;

	public getName(): string {
		return this.szInternalName;
	}

	public serialize(fileId: string) {
		const serialized: any = {
			name: this.szName,
			width: this.width,
			height: this.height,
		};
		if (this.binary) {
			serialized.url = settings.apiExternalUri(`/v1/vp/${fileId}/textures/${encodeURI(this.getName())}`);
			serialized.size = this.binary.cdata;
		}
		return serialized;
	}

	private async _load(buffer: Buffer, pos: number): Promise<void> {
		this.storageName = `Image${pos}`;
		const blocks = BiffParser.parseBiff(buffer);
		for (const block of blocks) {
			switch (block.tag) {
				case 'NAME':
					if (!this.szName) {
						this.szName = this.parseString(buffer, block, 4);
					}
					break;
				case 'INME':
					if (!this.szInternalName) {
						this.szInternalName = this.parseString(buffer, block, 4);
					}
					break;
				case 'PATH':
					if (!this.szPath) {
						this.szPath = this.parseString(buffer, block, 4);
					}
					break;
				case 'WDTH': this.width = this.parseInt(buffer, block); break;
				case 'HGHT': this.height = this.parseInt(buffer, block); break;
				case 'ALTV': this.alphaTestValue = this.parseFloat(buffer, block); break;
				case 'BITS': logger.warn(null, '[Texture.load] Ignoring BITS tag for %s at Image%s, implement when understood what it is.', this.szName, pos); break;
				case 'LINK': logger.warn(null, '[Texture.load] Ignoring LINK tag for %s at Image%s, implement when understood what it is.', this.szName, pos); break;
				case 'JPEG': this.binary = await Binary.load(buffer, block.pos + block.len); break;
			}
		}
	}
}
