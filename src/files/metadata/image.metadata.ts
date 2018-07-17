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

import { File } from '../file';
import { FileDocument } from '../file.document';
import { FileVariation } from '../file.variations';
import { Metadata } from './metadata';

require('bluebird').promisifyAll(gm.prototype);

export class ImageMetadata extends Metadata {

	public isValid(file: FileDocument, variation?: FileVariation): boolean {
		return File.getMimeTypePrimary(file, variation) === 'image';
	}

	public async getMetadata(file: FileDocument, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		return (gm(path) as any).identifyAsync();
	}

	public serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return pick(metadata, 'format', 'size', 'depth', 'JPEG-Quality');
	}

	public serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return {
			width: metadata.size.width,
			height: metadata.size.height,
		};
	}
}
