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
import { Storage } from '../common/ole-doc';
import { settings } from '../common/settings';
import { BiffParser } from './biff-parser';
import { Binary } from './binary';
import { LzwReader } from './gltf/lzw-reader';

export class Texture extends BiffParser {

	public storageName: string;
	public szName: string;
	public szInternalName: string;
	public szPath: string;
	public width: number;
	public height: number;
	public alphaTestValue: number;
	public binary: Binary;
	public pdsBuffer: BaseTexture;

	public static async fromStorage(storage: Storage, itemName: string): Promise<Texture> {
		const texture = new Texture();
		texture.storageName = itemName;
		await storage.streamFiltered(itemName, 0, Texture.createStreamHandler(storage, itemName, texture));
		return texture;
	}

	public static from(data: any): Texture {
		const texture = new Texture();
		Object.assign(texture, data);
		texture.binary = Binary.from(data.binary);
		return texture;
	}

	private static createStreamHandler(storage: Storage, itemName: string, texture: Texture) {
		texture.binary = new Binary();
		return BiffParser.stream((buffer, tag, offset, len) => texture.fromTag(buffer, tag, offset, len, storage, itemName), {
			nestedTags: {
				JPEG: {
					onStart: () => new Binary(),
					onTag: binary => binary.fromTag.bind(binary),
					onEnd: binary => texture.binary = binary,
				},
			}
		});
	}

	public getName(): string {
		return this.szInternalName;
	}

	public getUrl(fileId: string): string {
		const imageNum = this.storageName.match(/\d+$/)[0];
		return settings.apiExternalUri(`/v1/vp/${fileId}/images/${imageNum}/${this.binary.pos.toString(16)}/${this.binary.len.toString(16)}`);
	}

	public async getImage(storage: Storage): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			const strm = storage.stream(this.storageName, this.binary.pos, this.binary.len);
			const bufs: Buffer[] = [];
			if (!strm) {
				return reject(new Error('No such stream "' + this.storageName + '".'));
			}
			strm.on('error', reject);
			strm.on('data', (buf: Buffer) => bufs.push(buf));
			strm.on('end', () => resolve(Buffer.concat(bufs)));
		});
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

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number, storage: Storage, itemName: string): Promise<void> {
		switch (tag) {
			case 'NAME': this.szName = this.getString(buffer, len); break;
			case 'INME': this.szInternalName = this.getString(buffer, len); break;
			case 'PATH': this.szPath = this.getString(buffer, len); break;
			case 'WDTH': this.width = this.getInt(buffer); break;
			case 'HGHT': this.height = this.getInt(buffer); break;
			case 'ALTV': this.alphaTestValue = this.getFloat(buffer); break;
			case 'BITS': this.pdsBuffer = await BaseTexture.get(storage, itemName, offset, this.width, this.height); break;
			//case 'BITS': logger.warn(null, '[Texture.fromTag] Ignoring BITS tag for %s at %s, width = %s, height = %s.', this.szName, this.storageName, this.width, this.height); break;
			case 'LINK': logger.warn(null, '[Texture.fromTag] Ignoring LINK tag for %s at %s, implement when understood what it is.', this.szName, this.storageName); break;
			default: logger.warn(null, '[Texture.fromTag] Unknown tag "%s".', tag);
		}
	}
}

class BaseTexture {

	private static readonly RGBA = 0;
	private static readonly RGB_FP = 1;

	private width: number;
	private height: number;
	private realWidth: number;
	private realHeight: number;
	private format: number = BaseTexture.RGBA;
	private data: Buffer;

	constructor(width?: number, height?: number, realWidth?: number, realHeight?: number, format = BaseTexture.RGBA) {
		this.width = width;
		this.height = height;
		this.realWidth = realWidth;
		this.realHeight = realHeight;
		this.format = format;
	}

	public static async get(storage: Storage, itemName: string, pos: number, width: number, height: number): Promise<BaseTexture> {
		const pdsBuffer = new BaseTexture(width, height);
		console.log('--- reading rest of the storage buffer...');
		const compressedData = (await storage.read(itemName)).slice(pos);
		console.log('--- shoving %s bytes into decompressor...', compressedData.length);
		const lzwReader = new LzwReader(compressedData, width, height, pdsBuffer.pitch());
		const data = lzwReader.decompress();
		console.log('---- got %s bytes of BITS data!', data.length);
		return pdsBuffer;
	}

	public pitch(): number {
		return (this.format == BaseTexture.RGBA ? 4 : 3 * 4) * this.width;
	}
}
