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

import { Job } from 'bull';
import { rename, stat, unlink } from 'fs';
import { assign } from 'lodash';
import { dirname } from 'path';
import { promisify } from 'util';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { RequestState } from '../../common/typings/context';
import { state } from '../../state';
import { FileDocument } from '../file.document';
import { FileUtil } from '../file.util';
import { FileVariation } from '../file.variations';
import { Metadata } from '../metadata/metadata';
import { processorManager } from './processor.manager';
import { JobData } from './processor.queue';

const renameAsync = promisify(rename);
const statAsync = promisify(stat);
const unlinkAsync = promisify(unlink);

export class ProcessorWorker {

	/**
	 * This is the worker function that *creates* new variations.
	 *
	 * Note that creator jobs always get their own copy of the source file in
	 * order to avoid concurrency issues.
	 *
	 * @param {Job} job
	 * @return {Promise<any>}
	 */
	public static async create(job: Job): Promise<any> {
		let file: FileDocument;

		// retrieve data from deserialized job
		const data = job.data as JobData;
		const srcPath = data.srcPath;
		const destPath = data.destPath;
		const requestState = data.requestState;

		file = await state.models.File.findOne({ id: data.fileId }).exec();
		if (!file) {
			logger.warn(requestState, '[ProcessorWorker.create] [%s | #%s] skip: File "%s" has been removed from DB, ignoring.',
				data.processor, job.id, data.fileId);
			return null;
		}
		const processor = processorManager.getCreationProcessor(data.processor);
		const variation = file.getVariation(data.destVariation);
		if (!variation) {
			throw new ApiError('Got a non-variation on the creation queue: %s', file.toDetailedString());
		}

		try {

			// create directory
			if (!(await FileUtil.exists(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}
			logger.debug(requestState, '[ProcessorWorker.create] [%s | #%s] start: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), FileUtil.log(srcPath), FileUtil.log(destPath));

			// run processor
			await processor.process(requestState, file, srcPath, destPath, variation);
			logger.debug(requestState, '[ProcessorWorker.create] [%s | #%s] end: %s from %s to %s',
				data.processor, job.id, file.toDetailedString(variation), FileUtil.log(srcPath), FileUtil.log(destPath));

			// clean up source
			logger.debug(requestState, '[ProcessorWorker.create] Cleaning up variation source at %s', FileUtil.log(srcPath));
			await unlinkAsync(srcPath);

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(requestState, file, destPath, variation);
			const fileData: any = {};
			fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
				bytes: (await statAsync(destPath)).size,
				mime_type: variation.mimeType,
			});
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { new: true }).exec();

			// abort if deleted
			if (await ProcessorWorker.isFileDeleted(file)) {
				logger.debug(requestState, '[ProcessorWorker.create] Removing created file due to deletion %s', FileUtil.log(destPath));
				await unlinkAsync(destPath);
				return null;
			}

			// rename
			const newPath = await ProcessorWorker.isFileRenamed(requestState, file.getPath(requestState, variation), 'create');
			const finalPath = newPath || file.getPath(requestState, variation);
			if (!(await FileUtil.exists(dirname(finalPath)))) {
				await FileUtil.mkdirp(dirname(finalPath));
			}
			await renameAsync(destPath, finalPath);
			logger.debug(requestState, '[ProcessorWorker.create] [%s | #%s] done: %s at %s', data.processor, job.id, file.toDetailedString(variation), FileUtil.log(finalPath));

			// continue with dependents (and fresh data)
			file = await state.models.File.findOne({ id: data.fileId }).exec();
			if (!file) {
				return null;
			}
			await ProcessorWorker.continueCreation(requestState, file, variation);

			return finalPath;

		} catch (err) {

			// clean up source
			if (await FileUtil.exists(srcPath)) {
				await unlinkAsync(srcPath);
			}

			// nothing to return here because it's in the background.
			if (err.isApiError) {
				logger.error(requestState, err.print());
			} else {
				logger.error(requestState, '[ProcessorWorker.create] Error while processing %s with %s:\n\n%s\n\n', file ? file.toDetailedString(variation) : 'null', job.data.processor, ApiError.colorStackTrace(err));
			}
			// TODO log to raygun
		}
	}

	/**
	 * This is the worker function that *optimizes* an existing variation (or original)
	 *
	 * Note that we assume that original files always stay in the protected
	 * folder and aren't moved on activation. If that changes, the optimization
	 * queue must also work with a copy of the original file to avoid file
	 * access conflicts.
	 *
	 * @param {Job} job
	 * @return {Promise<any>}
	 */
	public static async optimize(job: Job): Promise<any> {
		let file: FileDocument;

		// retrieve data from deserialized job
		const data = job.data as JobData;
		const srcPath = data.srcPath;
		const destPath = data.destPath;
		const requestState = data.requestState;

		file = await state.models.File.findOne({ id: data.fileId }).exec();
		if (!file) {
			logger.warn(requestState, '[ProcessorWorker.optimize] [%s | #%s] skip: File "%s" has been removed from DB, ignoring.',
				data.processor, job.id, data.fileId);
			return null;
		}
		const processor = processorManager.getOptimizationProcessor(data.processor);
		const variation = file.getVariation(data.destVariation);

		try {

			// create directory
			if (!(await FileUtil.exists(dirname(destPath)))) {
				await FileUtil.mkdirp(dirname(destPath));
			}
			logger.debug(requestState, '[ProcessorWorker.optimize] [%s | #%s] start: %s at %s',
				data.processor, job.id, file.toDetailedString(variation), FileUtil.log(destPath));

			// run processor
			await processor.process(requestState, file, srcPath, destPath, variation);

			// update metadata
			const metadataReader = Metadata.getReader(file, variation);
			const metadata = await metadataReader.getMetadata(requestState, file, destPath, variation);
			const fileData: any = {};
			if (variation) {
				fileData['variations.' + variation.name] = assign(metadataReader.serializeVariation(metadata), {
					bytes: (await statAsync(destPath)).size,
					mime_type: variation.mimeType,
				});
			} else {
				fileData.metadata = await Metadata.readFrom(requestState, file, destPath);
				fileData.bytes = (await statAsync(destPath)).size;
			}
			await state.models.File.findByIdAndUpdate(file._id, { $set: fileData }, { new: true }).exec();

			// abort if deleted
			if (await ProcessorWorker.isFileDeleted(file)) {
				logger.debug(requestState, '[ProcessorWorker.optimize] Removing created file due to deletion %s', FileUtil.log(destPath));
				await unlinkAsync(destPath);
				return null;
			}

			// rename
			const newPath = await ProcessorWorker.isFileRenamed(requestState, file.getPath(requestState, variation), 'optimize');
			const finalPath = newPath || file.getPath(requestState, variation);
			await renameAsync(destPath, finalPath); // overwrites destination
			logger.debug(requestState, '[ProcessorWorker.optimize] [%s | #%s] done: %s at %s', data.processor, job.id, file.toDetailedString(variation), FileUtil.log(finalPath));

			return finalPath;

		} catch (err) {
			// nothing to return here because it's in the background.
			if (err.isApiError) {
				logger.error(requestState, err.print());
			} else {
				logger.error(requestState, '[ProcessorWorker.optimize] Error while processing %s with %s:\n\n%s\n\n', file ? file.toDetailedString(variation) : 'null', job.data.processor, ApiError.colorStackTrace(err));
			}
			// TODO log to raygun
		}
	}

	/**
	 * Queues variations that depend on the finished creation job.
	 *
	 * Since variations might take another variation as source, they can't be
	 * queued at the beginning when the source variation doesn't exist yet.
	 * If the given variation has dependent variations, this queues the them
	 * now they are available.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file File
	 * @param {FileVariation} createdVariation Created variation
	 */
	private static async continueCreation(requestState: RequestState, file: FileDocument, createdVariation: FileVariation) {

		// send direct references to creation queue (with a copy)
		const dependentVariations = file.getDirectVariationDependencies(createdVariation);
		for (const dependentVariation of dependentVariations) {
			const processor = processorManager.getValidCreationProcessor(requestState, file, createdVariation, dependentVariation);
			if (processor) {
				const srcPath = file.getPath(requestState, createdVariation, { tmpSuffix: '_' + dependentVariation.name + '.source' });
				const destPath = file.getPath(requestState, dependentVariation, { tmpSuffix: '_' + processor.name + '.processing' });
				await FileUtil.cp(file.getPath(requestState, createdVariation), srcPath);
				await processorManager.queueCreation(requestState, processor, file, srcPath, destPath, createdVariation, dependentVariation);
			} else {
				logger.error(requestState, '[ProcessorWorker.continueCreation] Cannot find a processor for %s which is dependent on %s.',
					file.toShortString(dependentVariation), file.toShortString(createdVariation));
			}
		}
		if (dependentVariations.length) {
			logger.debug(requestState, '[ProcessorWorker.continueCreation] Found [ %s ] as direct references for %s, passed them to creation processors.',
				dependentVariations.map(v => v.name).join(', '), file.toShortString(createdVariation));
		}

		// send variation to optimization queue.
		let n = 0;
		for (const processor of processorManager.getValidOptimizationProcessors(file, createdVariation)) {
			n++;
			const destPath = file.getPath(requestState, createdVariation, { tmpSuffix: '_' + processor.name + '.processing' });
			const srcPath = file.getPath(requestState, createdVariation);
			await processorManager.queueOptimization(requestState, processor, file, srcPath, destPath, createdVariation);
		}
		logger.debug(requestState, '[ProcessorWorker.continueCreation] Passed %s to optimization %s processor(s).',
			file.toShortString(createdVariation), n);
	}

	/**
	 * Checks whether a file has been marked as deleted and processing should be stopped.
	 *
	 * @param {FileDocument} file File to check
	 * @return {Promise<boolean>} True if the file was deleted, false otherwise.
	 */
	private static async isFileDeleted(file: FileDocument): Promise<boolean> {
		return !!(await state.redis.get('queue:delete:' + file.id));
	}

	/**
	 * Checks whether a file has been renamed ("activated") in order to write
	 * the file to the correct destination.
	 *
	 * @param requestState For logging
	 * @param {string} path Original path of the file
	 * @param {string} what Calling function for logging purpose
	 * @return {Promise<string | null>} Path to new destination or null if no rename
	 */
	private static async isFileRenamed(requestState: RequestState, path: string, what: string): Promise<string | null> {
		const newPath = await state.redis.get('queue:rename:' + path);
		if (newPath) {
			logger.info(requestState, '[ProcessorWorker.%s] Activation rename from %s to %s', what, FileUtil.log(path), FileUtil.log(newPath));
			return newPath;
		}
		return null;
	}
}
