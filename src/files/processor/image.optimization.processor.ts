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

import { createWriteStream, createReadStream } from 'fs';

const PngQuant = require('pngquant');
const OptiPng = require('optipng');

import { Processor, ProcessorQueue } from './processor';
import { File, FileVariation } from '../file';
import { logger } from '../../common/logger';
import { ApiError } from '../../common/api.error';

export class ImageOptimizationProcessor extends Processor<FileVariation> {

	canProcess(file: File, variation?: FileVariation): boolean {
		const mimeType = variation ? variation.mimeType : file.getMimeType();
		// currently only png files.
		return mimeType === 'image/png';
	}

	getPriority(variation?: FileVariation): number {
		return 500;
	}

	getQueue(): ProcessorQueue {
		return ProcessorQueue.LOW_PRIO_SLOW;
	}

	async process(file: File, src: string, dest: string, variation?: FileVariation): Promise<File> {

		if (file.file_type === 'playfield') {
			logger.info('[ImageOptimizationProcessor] Skipping pass 2 for %s (will process when orientation is set)', file.toString(variation));
			return file;
		}

		const quanter = new PngQuant([128]);
		const optimizer = new OptiPng(['-o7']);

		return new Promise<File>((resolve, reject) => {

			// create destination stream
			let writeStream = createWriteStream(dest);

			// setup success handler
			writeStream.on('finish', function () {
				logger.debug('[ImageOptimizationProcessor] Finished pass 2 for %s', file.toString(variation));
				resolve(file);
			});
			writeStream.on('error', reject);

			// setup error handler
			const handleErr = function (what:string) {
				return function (err:Error) {
					reject(new ApiError(err, 'Error at %s while processing %s', what, file.toString(variation)).log());
				};
			};

			// do the processing
			logger.debug('[ImageOptimizationProcessor] Optimizing %s %s', file.getMimeSubtype(variation), file.toString(variation));
			createReadStream(src).on('error', handleErr('reading'))
				.pipe(quanter).on('error', handleErr('quanter'))
				.pipe(optimizer).on('error', handleErr('optimizer'))
				.pipe(writeStream).on('error', handleErr('writing'));
		});
	}
}