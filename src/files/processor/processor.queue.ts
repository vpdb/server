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
import Bluebird from 'bluebird';

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
			queue.on('completed', this.onJobCompleted(type));
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
			return await this.waitForFileCompletion(file, variation);
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
		const promises:(() => Bluebird<any> | Promise<any>)[] = [];
		for (let q of this.queueTypes) {
			const queue = this.queues.get(q.name);

			// remove waiting jobs
			const waitingJobs = await queue.getWaiting();
			const waitingJobsForFile = waitingJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (waitingJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Removing %s jobs from queue %s', waitingJobsForFile.length, q.name);
			}
			promises.push(...waitingJobsForFile.map(job => () => job.remove()));

			// wait for active jobs and delete afterwards.
			const activeJobs = await queue.getActive();
			const activeJobsForFile = activeJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (activeJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Cleaning up after %s active job(s) from queue %s.', activeJobsForFile.length, q.name);
			}
			promises.push(...activeJobsForFile.map(job => () => this.waitForJobCompletion(queue, job).then(path => unlinkAsync(path))));
		}
		// noinspection JSIgnoredPromiseFromCall: do this in the background
		Promise.all(promises.map(fn => fn()));
	}

	private completeListeners:Map<string, ((result:any) => Promise<any>)[]> = new Map<string, ((result:any) => Promise<any>)[]>();

	/**
	 * Waits for all jobs of a given file/variation to be finished and executes
	 * the provided callback. If there were any previous listeners, the value
	 * passed to the callback is the last listener's result, otherwise it's the
	 * job's result.
	 *
	 * @param {File} file
	 * @param {FileVariation} variation
	 * @param {(path: string) => Promise<string>} callback
	 * @returns {Promise<void>}
	 */
	public async waitForCompletion(file:File, variation:FileVariation, callback:(result:any) => Promise<any>): Promise<void> {

		// first, check if there are any waiting or active jobs
		const numJobs = await this.countRemainingJobs(file.id, variation.name);

		// if that's the case, add the listener
		if (numJobs > 0) {

			// add to callback stack
			const id = file.id + ':' + variation.name;
			if (!this.completeListeners.has(id)) {
				this.completeListeners.set(id, []);
			}
			this.completeListeners.get(id).push(callback);
		}
	}

	private async countRemainingJobs(fileId:string, variationName:string): Promise<number> {
		let numbJobs = 0;
		for (let q of this.queues.values()) {
			const jobs = await (q as any).getJobs(['waiting', 'active']) as Job[];
			const remainingJobs = jobs.filter(j => j.data.fileId === fileId && j.data.variation === variationName);
			numbJobs += remainingJobs.length;
		}
		return numbJobs;
	}

	private onJobCompleted(queue:ProcessorQueueType) {
		return async (job:Job, result:any) => {

			// check if there are waiting complete listeners
			const id = job.data.fileId + ':' + job.data.variation;
			if (this.completeListeners.has(id)) {

				// check if this was the last job in all queues
				const numJobs = await this.countRemainingJobs(job.data.fileId, job.data.variation);

				// if so, call them one by one
				if (numJobs === 0) {
					logger.info('[ProcessorQueue.onJobCompleted] Last job for %s finished, calling %s subscribers.', id, this.completeListeners.get(id).length);
					let lastResult = result;
					for (let fn of this.completeListeners.get(id)) {
						lastResult = await fn(lastResult);
					}
					this.completeListeners.delete(id);
				}
			}
		}
	}

	/**
	 * Subscribes to all queues and returns when the given file with the given variation has processed.
	 * @param {File} file File ID to match
	 * @param {FileVariation} variation Variation to match. If none given, any variation is matched.
	 * @return {Promise<any>} Resolves with the job's result.
	 */
	private async waitForFileCompletion(file:File, variation?:FileVariation): Promise<any> {
		return await new Promise<void>(resolve => {
			const queues = this.queues;
			function completeListener(j:Job, result:any) {
				// if file ID doesn't match, ignore.
				if ((j.data as JobData).fileId !== file.id) {
					return;
				}
				// if variation given and no match, ignore.
				if (variation && (j.data as JobData).variation !== variation.name) {
					return;
				}
				logger.debug("[ProcessorQueue.waitForFileCompletion] Finished waiting for %s.", file.toString(variation));
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
	 * Subscribes to the queue of a given job and returns when the job has finished.
	 * @param {Bull.Queue} queue Queue to subscribe to
	 * @param {Bull.Job} job Job to wait for
	 * @returns {Promise<any>} Resolves with the job's result.
	 */
	private async waitForJobCompletion(queue:Queue, job:Job): Promise<any> {
		return await new Promise<void>(resolve => {
			logger.debug("[ProcessorQueue.waitForJobCompletion] Waiting for job %s to be completed.", job.id);
			function completeListener(j:Job, result:any) {
				// if job given and no match, ignore.
				if (job && j.id !== job.id) {
					return;
				}
				logger.debug("[ProcessorQueue.waitForJobCompletion] Finished waiting for job %s.", job.id);
				(queue as any).off('completed', completeListener);
				resolve(result);
			}
			queue.on('completed', completeListener);
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
				logger.warn('[ProcessorQueue.processJob] %s/#%s skip: File "%s" has been removed from DB, ignoring.', data.processor, job.id, data.fileId);
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
			logger.debug('[ProcessorQueue.processJob] %s/#%s start: %s at %s', data.processor, job.id, file.toDetailedString(variation), tmpPathLog);
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
			logger.debug('[ProcessorQueue.processJob] %s/#%s done: %s', data.processor, job.id, file.toDetailedString(variation));

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