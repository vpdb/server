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
import { Storage } from '../common/ole-doc';

export class Texture extends BiffParser {

	public static async fromStorage(storage: Storage, itemName: string): Promise<Texture> {
		const texture = new Texture();
		await storage.streamFiltered(itemName, 0, Texture.createStreamHandler(texture));
		return texture;
	}

	public static from(data: any): Texture {
		const texture = new Texture();
		Object.assign(texture, data);
		texture.binary = Binary.from(data.binary);
		return texture;
	}

	private static createStreamHandler(texture: Texture) {
		texture.binary = new Binary();
		return BiffParser.stream(texture.fromTag.bind(texture), {
			nestedTags: { JPEG: texture.binary.fromTag.bind(texture.binary) }
		});
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

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'NAME': this.szName = this.getString(buffer, len); break;
			case 'INME': this.szInternalName = this.getString(buffer, len); break;
			case 'PATH': this.szPath = this.getString(buffer, len); break;
			case 'WDTH': this.width = this.getInt(buffer); break;
			case 'HGHT': this.height = this.getInt(buffer); break;
			case 'ALTV': this.alphaTestValue = this.getFloat(buffer); break;
			case 'BITS': logger.warn(null, '[Texture.fromTag] Ignoring BITS tag for %s at Image%s, implement when understood what it is.', this.szName, offset); break;
			case 'LINK': logger.warn(null, '[Texture.fromTag] Ignoring LINK tag for %s at Image%s, implement when understood what it is.', this.szName, offset); break;
			default: logger.warn(null,'[Texture.fromTag] Unknown tag "%s".', tag);
		}
	}
}
