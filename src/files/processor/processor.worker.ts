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
import { exists, stat, rename, unlink } from 'fs';
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
const unlinkAsync = promisify(unlink);

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
			const srcPath = data.srcPath;
			const srcPathLog = srcPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}

			// process to temp file
			logger.debug('[ProcessorWorker.create] [%s | #%s] start: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcPathLog, destPathLog);

			// run processor
			await processor.process(file, srcPath, destPath, variation);
			logger.debug('[ProcessorWorker.create] [%s | #%s] end: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcPathLog, destPathLog);

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

			// clean up source if necessary
			if (variation.source) {
				logger.debug('[ProcessorWorker.processJob] Cleaning up variation source at %s', srcPathLog);
				await unlinkAsync(srcPath);
			}

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

		// send direct references to creation queue (with a copy)
		const directlyDependentVariations = file.getDirectVariationDependencies(variation);
		for (let dependentVariation of directlyDependentVariations) {
			const processor = processorManager.getValidCreationProcessor(file, variation, dependentVariation);
			if (processor) {
				const tmpPath = file.getPath(variation, { tmpSuffix: '_' + dependentVariation.name + '.source' });
				await FileUtil.cp(file.getPath(variation), tmpPath);
				await processorManager.queueFile('creation', processor, file, tmpPath, variation, dependentVariation);
			} else {
				logger.error('[ProcessorWorker.continueCreation] Cannot find a processor for %s which is dependent on %s.',
					file.toShortString(dependentVariation), file.toShortString(variation))
			}
		}
		if (directlyDependentVariations.length) {
			logger.debug('[ProcessorWorker.continueCreation] Found [ %s ] as direct references for %s, passed them to creation processors.',
				directlyDependentVariations.map(v => v.name).join(', '), file.toShortString(variation));
		}

		// send variation to optimization queue.
		let n = 0;
		for (let processor of processorManager.getValidOptimizationProcessors(file, variation)) {
			n++;
			await processorManager.queueFile('optimization', processor, file, file.getPath(variation), variation);
		}
		logger.debug('[ProcessorWorker.continueCreation] Passed %s to optimization %s processor(s).',
			file.toShortString(variation), n);

	}
}