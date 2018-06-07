/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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
import gm from 'gm';
import { pick } from 'lodash';

import { Metadata } from './metadata';
import { File } from '../file';
import { FileVariation } from '../file.variations';
import { FileDocument } from '../file.document';

require('bluebird').promisifyAll(gm.prototype);

export class ImageMetadata extends Metadata {

	isValid(file: File, variation?: FileVariation): boolean {
		return FileDocument.getMimeTypePrimary(file, variation) === 'image';
	}

	async getMetadata(file: File, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		return await (gm(path) as any).identifyAsync();
	}

	serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return pick(metadata, 'format', 'size', 'depth', 'JPEG-Quality');
	}

	serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return {
			width: metadata.size.width,
			height: metadata.size.height
		};
	}
}