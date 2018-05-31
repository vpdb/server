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
			logger.warn('[ProcessorWorker.create] [%s | #%s] skip: File "%s" has been removed from DB, ignoring.',
				data.processor, job.id, data.fileId);
			return null;
		}
		const processor = processorManager.getCreationProcessor(data.processor);
		const variation = file.getVariation(data.destVariation);
		if (!variation) {
			throw new ApiError('Got a non-variation on the creation queue: %s', file.toDetailedString());
		}

		try {
			const srcPath = data.srcPath;
			const srcPathLog = srcPath.split(sep).slice(-3).join('/');
			const destPath = data.destPath;
			const destPathLog = destPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}
			logger.debug('[ProcessorWorker.create] [%s | #%s] start: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcPathLog, destPathLog);

			// run processor
			await processor.process(file, srcPath, destPath, variation);
			logger.debug('[ProcessorWorker.create] [%s | #%s] end: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), srcPathLog, destPathLog);

			// clean up source if necessary
			if (variation.source) {
				logger.debug('[ProcessorWorker.processJob] Cleaning up variation source at %s', srcPathLog);
				await unlinkAsync(srcPath);
			}

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(file, destPath, variation);
			const fileData: any = {};
			fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
				bytes: (await statAsync(destPath)).size,
				mime_type: variation.mimeType
			});
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { 'new': true }).exec();

			if (await this.isFileDeleted(file, 'create')) {
				return null;
			}

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

		// retrieve data from deserialized job
		const data = job.data as JobData;
		file = await state.models.File.findOne({ id: data.fileId }).exec();
		if (!file) {
			logger.warn('[ProcessorWorker.optimize] [%s | #%s] skip: File "%s" has been removed from DB, ignoring.',
				data.processor, job.id, data.fileId);
			return null;
		}
		const processor = processorManager.getOptimizationProcessor(data.processor);
		const variation = file.getVariation(data.destVariation);

		try {
			const srcPath = data.srcPath;
			const destPath = data.destPath;
			const destPathLog = destPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}
			logger.debug('[ProcessorWorker.optimize] [%s | #%s] start: %s at %s',
				data.processor, job.id, file.toDetailedString(variation), destPathLog);

			// run processor
			await processor.process(file, srcPath, destPath, variation);

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(file, destPath, variation);
			const fileData: any = {};
			if (variation) {
				fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
					bytes: (await statAsync(destPath)).size,
					mime_type: variation.mimeType
				});
			} else {
				fileData.metadata = await Metadata.readFrom(file, destPath);
				fileData.bytes = (await statAsync(destPath)).size;
			}
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { 'new': true }).exec();

			// if deleting, abort.
			if (await this.isFileDeleted(file, 'optimize')) {
				return null;
			}

			// wait for other jobs accessing destination
			await processorManager.waitForSrcProcessingFinished(file, file.getPath(variation));

			// see if dest changed meanwhile through activation

			// rename
			await renameAsync(destPath, file.getPath(variation)); // overwrites destination
			logger.debug('[ProcessorWorker.optimize] [%s | #%s] done: %s', data.processor, job.id, file.toDetailedString(variation));

			return file.getPath(variation);

		} catch (err) {
			// nothing to return here because it's in the background.
			if (err.isApiError) {
				logger.error(err.print());
			} else {
				logger.error('[ProcessorWorker.optimize] Error while processing %s with %s:\n\n%s\n\n', file ? file.toDetailedString(variation) : 'null', job.data.processor, ApiError.colorStackTrace(err));
			}
			// TODO log to raygun
		}
	}

	private static async continueCreation(file:File, variation:FileVariation) {

		// send direct references to creation queue (with a copy)
		const directlyDependentVariations = file.getDirectVariationDependencies(variation);
		for (let dependentVariation of directlyDependentVariations) {
			const processor = processorManager.getValidCreationProcessor(file, variation, dependentVariation);
			if (processor) {
				const srcPath = file.getPath(variation, { tmpSuffix: '_' + dependentVariation.name + '.source' });
				const destPath = file.getPath(variation, { tmpSuffix: '_' + processor.name + '.processing' });
				await FileUtil.cp(file.getPath(variation), srcPath);
				await processorManager.queueFile('creation', processor, file, srcPath, destPath, variation, dependentVariation);
			} else {
				logger.error('[ProcessorWorker.continueCreation] Cannot find a processor for %s which is dependent on %s.',
					file.toShortString(dependentVariation), file.toShortString(variation));
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
			const destPath = file.getPath(null, { tmpSuffix: '_' + processor.name + '.processing' });
			await processorManager.queueFile('optimization', processor, file, file.getPath(variation), destPath, variation);
		}
		logger.debug('[ProcessorWorker.continueCreation] Passed %s to optimization %s processor(s).',
			file.toShortString(variation), n);
	}

	private static async isFileDeleted(file:File, what:string):Promise<boolean> {
		if (await state.redis.getAsync('queue:delete:' + file.id)) {
			logger.info('[ProcessorWorker.%s] File %s is deleted, aborting.', what, file.id);
			return true;
		}
		return false;
	}
}