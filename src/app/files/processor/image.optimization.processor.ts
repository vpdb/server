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

import { createReadStream, createWriteStream } from 'fs';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { RequestState } from '../../common/typings/context';
import { FileDocument } from '../file.document';
import { FileUtil } from '../file.util';
import { FileVariation } from '../file.variations';
import { OptimizationProcessor } from './processor';

const PngQuant = require('pngquant');
const OptiPng = require('optipng');

export class ImageOptimizationProcessor implements OptimizationProcessor<FileVariation> {

	public name: string = 'image.optimization';

	public canProcess(file: FileDocument, variation?: FileVariation): boolean {
		// currently only png files.
		return file.getMimeType(variation) === 'image/png';
	}

	public modifiesFile(): boolean {
		return true;
	}

	public getOrder(variation?: FileVariation): number {
		return 500;
	}

	public async process(requestState: RequestState, file: FileDocument, src: string, dest: string, variation?: FileVariation): Promise<string> {

		if (file.file_type === 'playfield') {
			logger.info(requestState, '[ImageOptimizationProcessor] Skipping (will process when orientation is set): %s', file.toDetailedString(variation));
			return null;
		}

		const quanter = new PngQuant([128]);
		const optimizer = new OptiPng(['-o7']);

		return new Promise<string>((resolve, reject) => {

			// create destination stream
			const writeStream = createWriteStream(dest);

			// setup success handler
			writeStream.on('finish', () => {
				logger.debug(requestState, '[ImageOptimizationProcessor] Done: %s', file.toDetailedString(variation));
				resolve(dest);
			});
			writeStream.on('error', reject);

			// setup error handler
			const handleErr = (what: string) => {
				/* istanbul ignore next */
				return (err: Error) => {
					reject(new ApiError('Error at %s while processing.', what).display('Error at %s while processing %s.', what, file.toShortString(variation)).log(err));
				};
			};

			// do the processing
			logger.debug(requestState, '[ImageOptimizationProcessor] Start: %s from %s to %s', file.toDetailedString(variation), FileUtil.log(src), FileUtil.log(dest));
			createReadStream(src).on('error', handleErr('reading'))
				.pipe(quanter).on('error', handleErr('quanter'))
				.pipe(optimizer).on('error', handleErr('optimizer'))
				.pipe(writeStream).on('error', handleErr('writing'));
		});
	}
}
