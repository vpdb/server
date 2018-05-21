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

import { rename, stat, exists, unlink } from 'fs';
import { promisify } from 'util';
import { dirname, sep } from 'path';
import { assign } from 'lodash';
import Bull, { Job, JobOptions, Queue, QueueOptions } from 'bull';

import { state } from '../../state';
import { config } from '../../common/settings';
import { logger } from '../../common/logger';
import { File } from '../file';
import { Processor } from './processor';
import { ImageVariationProcessor } from './image.variation.processor';
import { ImageOptimizationProcessor } from './image.optimization.processor';
import { fileTypes } from '../file.types';
import { FileVariation } from '../file.variations';
import { Metadata } from '../metadata/metadata';
import { FileUtil } from '../file.util';
import { ApiError } from '../../common/api.error';

const renameAsync = promisify(rename);
const statAsync = promisify(stat);
const existsAsync = promisify(exists);
const unlinkAsync = promisify(unlink);

class ProcessorQueue {

	private processors: Map<string, Processor<any>> = new Map();
	private queues: Map<string, Queue> = new Map();
	private queueTypes:ProcessorQueueType[] = [
		{ name: 'HI_PRIO_FAST', source: 'original'},
		{ name: 'LOW_PRIO_SLOW', source: 'variation'},
	];

	constructor() {

		// redis options
		const opts: QueueOptions = {
			redis: {
				port: config.vpdb.redis.port,
				host: config.vpdb.redis.host,
				db: config.vpdb.redis.db
			}
		};

		// create queues
		for (let type of this.queueTypes) {
			const queue = new Bull(type.name, opts);
			queue.process(this.processJob.bind(this));
			this.queues.set(type.name, queue);
		}

		// create processors
		const processors: Processor<any>[] = [new ImageVariationProcessor(), new ImageOptimizationProcessor()];
		processors.forEach(p => this.processors.set(p.name, p));
	}

	/**
	 * Adds a file to be processed by the queue.
	 * @param {File} file Fiel to be processed
	 * @param {string} src Path to file
	 * @return {Promise<any>}
	 */
	public async processFile(file: File, src: string): Promise<any> {

		// match processors against file variations
		let n = 0;
		for (let processor of this.processors.values()) {

			// first, add jobs for the original
			if (processor.canProcess(file)) {
				const job = await this.queues.get(processor.getQueue()).add(this.getJobData(file, src, processor), {
					priority: processor.getOrder(),
					// removeOnComplete: true,
					// removeOnFail: true
				} as JobOptions);
				logger.debug('[ProcessorQueue.processFile] Added original file %s to queue %s with processor %s (%s).', file.toDetailedString(), processor.getQueue(), processor.name, job.id);
				n++;
			}

			// then for each variation
			for (let variation of file.getVariations()) {
				if (processor.canProcess(file, variation)) {
					const job = await this.queues.get(processor.getQueue()).add(this.getJobData(file, src, processor, variation), {
						priority: processor.getOrder(variation),
						// removeOnComplete: true,
						// removeOnFail: true
					} as JobOptions);
					logger.debug('[ProcessorQueue.processFile] Added %s to queue %s with processor %s (%s).', file.toDetailedString(variation), processor.name, processor.getQueue(), job.id);
					n++;
				}
			}
		}
		if (n === 0) {
			logger.info('[ProcessorQueue.processFile] No processors matched the file or any variation.');
		}
	}

	/**
	 * Waits until a file variation is processed and returns the path.
	 * @param {File} file
	 * @param {FileVariation} variation
	 * @return {Promise<void>} Path to the processed file
	 */
	public async getProcessedFile(file: File, variation: FileVariation): Promise<string> {
		const path = file.getPath(variation);
		const job = await this.getJob(file, variation);
		if (job) {
			logger.info("[ProcessorQueue.getProcessedFile] Waiting for %s to finish processing", file.toString(variation));
			return await this.waitForCompletion(file, variation);
		} else {
			// so it's not an active or waiting job, let's check the file system
			if ((await existsAsync(path)) && (await statAsync(path)).size > 0) {
				logger.info("[ProcessorQueue.getProcessedFile] %s has finished processing", file.toString(variation));
				return path;
			}
			throw new ApiError('Cannot find job for %s at %s.', file.toString(variation), path);
		}
	}

	/**
	 * Removes all waiting jobs for a given file from all queues and deletes
	 * the result of all currently active jobs for the given file.
	 *
	 * @param {File} file File to delete
	 * @return {Promise<void>}
	 */
	public async deleteProcessingFile(file: File): Promise<void> {
		for (let queue of this.queues.values()) {
			// remove waiting jobs
			const waitingJobs = await queue.getWaiting();
			await Promise.all(waitingJobs
				.filter(job => (job.data as JobData).fileId === file.id)
				.map(job => job.remove()));

			// wait for active jobs and delete afterwards.
			const activeJobs = await queue.getActive();
			await Promise.all(activeJobs
				.filter(job => (job.data as JobData).fileId === file.id)
				.map(job => this.waitForCompletion(null, null, job).then(path => unlinkAsync(path))));
		}
	}

	/**
	 * Subscribes to all queues and returns when the given file with the given variation has processed.
	 * @param {File} [file] File ID to match
	 * @param {FileVariation} variation Variation to match. If none given, any variation is matched.
	 * @param {Job} [job] Job to match.
	 * @return {Promise<any>} Resolves with the job's result.
	 */
	private async waitForCompletion(file?:File, variation?:FileVariation, job?:Job): Promise<any> {
		return await new Promise<void>(resolve => {
			const queues = this.queues;
			function completeListener(j:Job, result:any) {
				// if file ID doesn't match, ignore.
				if (file && (j.data as JobData).fileId !== file.id) {
					return;
				}
				// if variation given and no match, ignore.
				if (variation && (j.data as JobData).variation !== variation.name) {
					return;
				}
				// if job given and no match, ignore.
				if (job && j.id !== job.id) {
					return;
				}
				logger.debug("[ProcessorQueue.getProcessedFile] Finished waiting for %s.", file.toString(variation));
				for (let queue of queues.values()) {
					(queue as any).off('completed', completeListener);
				}
				resolve(result);
			}
			for (let queue of this.queues.values()) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Retrieves the job from the waiting or active jobs.
	 * @param {File} file
	 * @param {FileVariation} variation
	 * @return {Promise<Bull.Job>}
	 */
	private async getJob(file:File, variation?:FileVariation): Promise<Job> {
		for (let queue of this.queues.values()) {

			// try waiting jobs first
			const waitingJobs = await queue.getWaiting();
			const waitingJob = waitingJobs.find(job => (job.data as JobData).fileId === file.id && (variation ? (job.data as JobData).variation === variation.name : true));
			if (waitingJob) {
				return waitingJob;
			}

			// then active jobs
			const activeJobs = await queue.getActive();
			const activeJob = activeJobs.find(job => (job.data as JobData).fileId === file.id && (variation ? (job.data as JobData).variation === variation.name : true));
			if (activeJob) {
				return activeJob;
			}
		}
		return null;
	}

	/**
	 * This is the worker function that is pulled from the queue.
	 *
	 * @param {Bull.Job} job
	 * @return {Promise<any>}
	 */
	private async processJob(job: Job): Promise<any> {
		let file:File;
		try {
			// retrieve data from deserialized job
			const data = job.data as JobData;
			file = await state.models.File.findOne({ id: data.fileId }).exec();
			if (!file) {
				logger.warn('[ProcessorQueue.processJob] File "%s" has been removed from DB, ignoring.', data.fileId);
				return null;
			}
			const processor = this.processors.get(data.processor);
			const variation = fileTypes.getVariation(file.file_type, file.mime_type, data.variation);

			const tmpPath = file.getPath(variation, { tmpSuffix: '_' + processor.name + '.processing' });
			const tmpPathLog = tmpPath.split(sep).slice(-3).join('/');

			// create directory
			if (!(await existsAsync(dirname(tmpPath)))) {
				await FileUtil.mkdirp(dirname(tmpPath));
			}

			// wait for source
			const queue = this.queueTypes.find(q => q.name === processor.getQueue());
			let src:string;
			if (variation && queue.source === 'variation') {
				src = await this.getProcessedFile(file, variation);
			} else {
				src = data.src;
			}

			// process to temp file
			logger.debug('[ProcessorQueue.processJob] Start: %s at %s', file.toDetailedString(variation), tmpPathLog);
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
			logger.debug('[ProcessorQueue.processJob] Done: %s', file.toDetailedString(variation));

			return file.getPath(variation);

		} catch (err) {
			// nothing to return here because it's in the background.
			logger.error('Error while processing %s with %s:\n\n' + ApiError.colorStackTrace(err) + '\n\n', file ? file.toString() : 'null', job.data.processor);
			// TODO log to raygun
		}
	}

	/**
	 * Returns the job data that will be serialized and given to the worker
	 * function.
	 *
	 * @param {File} file File to be processed
	 * @param {string} src Path to file
	 * @param {Processor<any>} processor Processor
	 * @param {FileVariation} variation File variation
	 * @return {JobData}
	 */
	private getJobData(file: File, src: string, processor: Processor<any>, variation?: FileVariation): JobData {
		return {
			src: src,
			fileId: file.id,
			processor: processor.name,
			variation: variation ? variation.name : undefined
		}
	}
}

interface JobData {
	src: string;
	fileId: string;
	processor: string;
	variation?: string;
}

interface ProcessorQueueType {
	/**
	 * Name of the queue. Processors link to that name.
	 */
	name: ProcessorQueueName;

	/**
	 * Source file.
	 *  - If set to `original`, the uploaded file is used even for variation.
	 *  - If set to `variation`, the variation is awaited and used for variations.
	 */
	source: 'original' | 'variation'
}

export type ProcessorQueueName = 'HI_PRIO_FAST' | 'LOW_PRIO_SLOW';

export const processorQueue = new ProcessorQueue();