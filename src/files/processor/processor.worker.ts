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

import { promisify } from 'util';
import { dirname, sep } from 'path';
import { exists, stat, rename } from 'fs';
import { assign } from 'lodash';
import { Job } from 'bull';

import { state } from '../../state';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { Metadata } from '../metadata/metadata';
import { File } from '../file';
import { FileUtil } from '../file.util';
import { processorManager } from './processor.manager';
import { JobData } from './processor.queue';
import { FileVariation } from '../file.variations';

const renameAsync = promisify(rename);
const statAsync = promisify(stat);
const existsAsync = promisify(exists);

export class ProcessorWorker {

	/**
	 * This is the worker function that *creates* new variations.
	 *
	 * @param {Job} job
	 * @return {Promise<any>}
	 */
	public static async create(job: Job): Promise<any> {
		let file: File;

		// retrieve data from deserialized job
		const data = job.data as JobData;
		file = await state.models.File.findOne({ id: data.fileId }).exec();
		if (!file) {
			logger.warn('[ProcessorWorker.create] %s/#%s skip: File "%s" has been removed from DB, ignoring.',
				data.processor, job.id, data.fileId);
			return null;
		}
		const processor = processorManager.getCreationProcessor(data.processor);
		const variation = file.getVariation(data.destVariation);
		if (!variation) {
			throw new ApiError('Got a non-variation on the creation queue: %s', file.toDetailedString());
		}

		try {
			const destPath = file.getPath(variation, { tmpSuffix: '_' + processor.name + '.processing' });
			const destPathLog = destPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}

			let src: string;
			if (data.srcVariation) {
				const srcVariation = file.getVariation(data.srcVariation);
				src = file.getPath(srcVariation);
			} else {
				src = file.getPath(null, { tmpSuffix: '_original' });
			}
			const srcLog = src.split(sep).slice(-3).join('/');

			// process to temp file
			logger.debug('[ProcessorWorker.create] [%s | #%s] start: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcLog, destPathLog);

			// run processor
			await processor.process(file, src, destPath, variation);
			logger.debug('[ProcessorWorker.create] [%s | #%s] end: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcLog, destPathLog);

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(file, destPath, variation);
			const fileData: any = {};
			fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
				bytes: (await statAsync(destPath)).size,
				mime_type: variation.mimeType
			});
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { 'new': true }).exec();

			// rename
			await renameAsync(destPath, file.getPath(variation));
			logger.debug('[ProcessorWorker.processJob] [%s | #%s] done: %s', data.processor, job.id, file.toDetailedString(variation));

			// continue with dependents
			await ProcessorWorker.continueCreation(file, variation);

			return file.getPath(variation);

		} catch (err) {
			// nothing to return here because it's in the background.
			if (err.isApiError) {
				logger.error(err.print());
			} else {
				logger.error('[ProcessorWorker.create] Error while processing %s with %s:\n\n%s\n\n', file ? file.toDetailedString(variation) : 'null', job.data.processor, ApiError.colorStackTrace(err));
			}
			// TODO log to raygun
		}
	}

	/**
	 * This is the worker function that *optimizes* an existing variation (or original)
	 *
	 * @param {Job} job
	 * @return {Promise<any>}
	 */
	public static async optimize(job: Job): Promise<any> {
		let file: File;
		try {
			// retrieve data from deserialized job
			const data = job.data as JobData;
			file = await state.models.File.findOne({ id: data.fileId }).exec();
			if (!file) {
				logger.warn('[ProcessorWorker.optimize] %s/#%s skip: File "%s" has been removed from DB, ignoring.',
					data.processor, job.id, data.fileId);
				return null;
			}
			const processor = processorManager.getOptimizationProcessor(data.processor);
			const variation = file.getVariation(data.destVariation);

			const tmpPath = file.getPath(variation, { tmpSuffix: '_' + processor.name + '.processing' });
			const tmpPathLog = tmpPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(tmpPath)))) {
				await FileUtil.mkdirp(dirname(tmpPath));
			}

			const src = file.getPath(variation);

			// process to temp file
			logger.debug('[ProcessorWorker.optimize] [%s | #%s] start: %s at %s',
				data.processor, job.id, file.toDetailedString(variation), tmpPathLog);
			await processor.process(file, src, tmpPath, variation);

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(file, tmpPath, variation);
			const fileData: any = {};
			if (variation) {
				fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
					bytes: (await statAsync(tmpPath)).size,
					mime_type: variation.mimeType
				});
			} else {
				fileData.metadata = await Metadata.readFrom(file, tmpPath);
				fileData.bytes = (await statAsync(tmpPath)).size;
			}
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { 'new': true }).exec();

			// rename
			await renameAsync(tmpPath, file.getPath(variation));
			logger.debug('[ProcessorWorker.optimize] [%s | #%s] done: %s', data.processor, job.id, file.toDetailedString(variation));

			return file.getPath(variation);

		} catch (err) {
			// nothing to return here because it's in the background.
			logger.error('[ProcessorWorker.optimize] Error while processing %s with %s:\n\n' + ApiError.colorStackTrace(err) + '\n\n', file ? file.toShortString() : 'null', job.data.processor);
			// TODO log to raygun
		}
	}

	private static async continueCreation(file:File, variation:FileVariation) {

		// if this variation isn't referenced, send it to optimization queue.
		const dependentVariations = file.getVariationDependencies(variation);
		let n = 0;
		if (dependentVariations.length === 0) {
			for (let processor of processorManager.getValidOptimizationProcessors(file, variation)) {
				n++;
				await processorManager.queueFile('optimization', processor, file, variation);
			}
			logger.debug('[ProcessorWorker.processJob] Found no references, passed %s to optimization %s processor(s).',
				file.toShortString(variation), n);

		// otherwise, send direct references to creation queue
		} else {
			const directlyDependentVariations = file.getDirectVariationDependencies(variation);
			for (let dependentVariation of directlyDependentVariations) {
				const processor = processorManager.getValidCreationProcessor(file, variation, dependentVariation);
				if (processor) {
					await processorManager.queueFile('creation', processor, file, variation, dependentVariation);
				} else {
					logger.error('[ProcessorWorker.processJob] Cannot find a processor for %s which dependent on %s.',
						file.toShortString(dependentVariation), file.toShortString(variation))
				}
			}
			logger.debug('[ProcessorWorker.processJob] Found [ %s ] as direct references for %s, passed them to creation processors.',
				directlyDependentVariations.map(v => v.name).join(', '), file.toShortString(variation));
		}
	}
}