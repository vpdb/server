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

import { createWriteStream } from 'fs';
import gm, { State } from 'gm';
import { Readable } from 'stream';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { RequestState } from '../../common/typings/context';
import { XmlParser } from '../../common/xml.parser';
import { FileDocument } from '../file.document';
import { mimeTypes } from '../file.mimetypes';
import { BackglassVariation, FileVariation } from '../file.variations';
import { CreationProcessor } from './processor';

const { Base64Decode } = require('base64-stream');

require('bluebird').promisifyAll(gm.prototype);

export class Directb2sThumbProcessor implements CreationProcessor<BackglassVariation> {

	public name: string = 'directb2s.thumb';

	public canProcess(file: FileDocument, srcVariation: FileVariation, destVariation: FileVariation): boolean {
		return file.getMimeType(srcVariation) === 'application/x-directb2s' && file.getMimeCategory(destVariation) === 'image';
	}

	public getOrder(variation?: FileVariation): number {
		return 200 + (variation && variation.priority ? variation.priority : 0);
	}

	public async process(requestState: RequestState, file: FileDocument, src: string, dest: string, variation?: BackglassVariation): Promise<string> {
		const now = Date.now();
		logger.debug(requestState, '[Directb2sThumbProcessor] Starting processing %s at %s.', file.toShortString(variation), dest);
		return new Promise<string>((resolve, reject) => {

			logger.debug(requestState, '[Directb2sThumbProcessor] Reading DirectB2S Backglass from %s', src);
			const parser = new XmlParser(src);
			let currentTag: string;
			let backglassFound = false;
			parser.on('opentagstart', tag => {
				currentTag = tag.name;
			});
			parser.on('attribute', attr => {
				if (currentTag === 'BackglassImage' && attr.name === 'Value' && !backglassFound) {
					backglassFound = true;
					logger.debug(requestState, '[Directb2sThumbProcessor] Found backglass image, pausing XML parser...');
					parser.pause();
					const source = new Readable();
					source._read = () => {
						source.push(attr.value);
						source.push(null);
					};

					const imgStream = source
						.on('error', this.error(reject, 'Error reading encoded stream.'))
						.pipe(new Base64Decode())
						.on('error', this.error(reject, 'Error reading decoded stream.'));

					// setup gm
					const img: State = gm(imgStream);

					(img as any).sizeAsync({ bufferStream: true }).then((size: any) => {

						img.quality(variation.quality || 70);
						img.interlace('Line');

						if (variation.cutGrill && file.metadata.grill_height && size) {
							img.crop(size.width, size.height - file.metadata.grill_height, 0, 0);
							logger.info(requestState, size);
							logger.info(requestState, '[Directb2sThumbProcessor] Cutting off grill for variation %s, new height = ', file.toShortString(variation), size.height - file.metadata.grill_height);
						}

						if (variation.width && variation.height) {
							img.resize(variation.width, variation.height);
						}

						if (variation.mimeType && mimeTypes[variation.mimeType]) {
							img.setFormat(mimeTypes[variation.mimeType].ext);
						}

						if (variation.modulate) {
							img.modulate(variation.modulate, 100, 100);
						}

						const writeStream = createWriteStream(dest);

						// setup success handler
						writeStream.on('finish', () => {
							logger.info(requestState, '[Directb2sThumbProcessor] Saved extracted backglass to "%s" (%sms).', dest, Date.now() - now);
							parser.resume();
						});
						writeStream.on('error', this.error(reject, 'Error writing stream to ' + dest));
						img.stream()
							.on('error', this.error(reject, 'Error reading image stream'))
							.pipe(writeStream)
							.on('error', this.error(reject, 'Error writing encoded stream.'));

					}).catch(/* istanbul ignore next */ (err: Error) => {
						reject(new ApiError('Error getting size from image.').log(err));
					});
				}
			});
			parser.on('error', this.error(reject, 'Error parsing direct2b file from ' + src));

			parser.on('end', () => {
				if (!backglassFound) {
					return reject(new ApiError('DirectB2s parsed at %s but no backglass image found.', src));
				}
				resolve(dest);
			});
			parser.stream(true);
		});
	}

	private error(reject: (err: Error) => void, message: string) {
		/* istanbul ignore next */
		return (err: Error) => {
			reject(new ApiError(message).log(err));
		};
	}

}
