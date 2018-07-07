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

import { createReadStream } from 'fs';
import { pick } from 'lodash';
import { createStream } from 'sax';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { File } from '../file';
import { FileDocument } from '../file.document';
import { FileVariation } from '../file.variations';
import { Metadata } from './metadata';

export class Directb2sMetadata extends Metadata {

	public isValid(file: File, variation?: FileVariation): boolean {
		return FileDocument.getMimeType(file, variation) === 'application/x-directb2s';
	}

	// TODO try https://github.com/nikku/saxen
	public async getMetadata(file: File, path: string): Promise<{ [p: string]: any }> {
		const now = Date.now();
		return new Promise((resolve, reject) => {
			const metadata: any = {};
			const saxStream = createStream(true, {});
			saxStream.on('error', this.error(reject, 'Error parsing Directb2s metadata.'));
			saxStream.on('opentag', node => {
				switch (node.name) {
					case 'DirectB2SData': metadata.version = node.attributes.Version; break;
					case 'Name': metadata.name = node.attributes.Value; break;
					case 'TableType': metadata.table_type = node.attributes.Value; break;
					case 'DMDType': metadata.dmd_type = node.attributes.Value; break;
					case 'GrillHeight': metadata.grill_height = node.attributes.Value; break;
					case 'DualBackglass': metadata.dual_backglass = node.attributes.Value; break;
					case 'Author': metadata.author = node.attributes.Value; break;
					case 'Artwork': metadata.artwork = node.attributes.Value; break;
					case 'GameName': metadata.gamename = node.attributes.Value; break;
				}
			});
			saxStream.on('end', () => {
				logger.info('[Directb2sMetadata] Retrieved metadata in %sms.', Date.now() - now);
				resolve(metadata);
			});
			createReadStream(path).on('error', this.error(reject, 'Error reading file at ' + path))
				.pipe(saxStream).on('error', this.error(reject, 'Error parsing XML metadata.'));
		});
	}

	public serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return pick(metadata, 'name', 'version', 'author', 'gamename');
	}

	/* istanbul ignore next */
	public serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return undefined;
	}

	private error(reject: (err: Error) => void, message: string) {
		return (err: Error) => {
			reject(new ApiError(message).log(err));
		};
	}
}
