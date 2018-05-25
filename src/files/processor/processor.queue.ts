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
import { ApiError } from '../../common/api.error';
import { config } from '../../common/settings';
import { logger } from '../../common/logger';
import { File } from '../file';
import { fileTypes } from '../file.types';
import { FileVariation } from '../file.variations';
import { FileUtil } from '../file.util';
import { Metadata } from '../metadata/metadata';
import { Processor } from './processor';
import { ActivateFileAction, ProcessorAction } from './processor.action';
import { Directb2sOptimizationProcessor } from './directb2s.optimization.processor';
import { Directb2sThumbProcessor } from './directb2s.thumb.processor';
import { ImageOptimizationProcessor } from './image.optimization.processor';
import { ImageVariationProcessor } from './image.variation.processor';
import { VptBlockindexProcessor } from './vpt.blockindex.processor';

const renameAsync = promisify(rename);
const statAsync = promisify(stat);
const existsAsync = promisify(exists);
const unlinkAsync = promisify(unlink);

/**
 * Processes files after upload.
 *
 * When uploading a file, other versions of the file are created, and those
 * along with the original file are further manipulated. For example, an image
 * upload gets copies with different dimensions, and all versions get optimized.
 * Or a DirectB2S gets optimized as well, plus a thumb for previews (which also
 * gets optimized, but by a different processor).
 *
 * A *processor* is a class that takes in a file object from the database and
 * produces a file on the disk. It is parameterized by an optional variation.
 *
 * A *variation* defines the produced file on the disk. It can be a different
 * MIME type than the original. Providing no variation results in the original
 * being processed.
 *
 * An *action* is a function linked to a file and all its variations that is
 * added at the end of the processing stack. It is individually triggered but
 * also blocking, i.e. adding multiple actions will execute sequentially and
 * block until the last action is executed. An example is the
 * `ActivateFileAction` which moves files into the public folder when the file
 * becomes public.
 *
 * This queue allows executing processors in an optimal way with the following
 * requirements:
 *
 * - Some items should be treated with high priority, because they are needed
 *   immediately after upload (e.g. thumbs)
 * - Some items need a previous processor to be completed first (e.g. optimizing
 *   a thumb variation needs the variation to be created in the first place)
 * - Items can be moved to another folder at any point (even when not finished
 *   processing), because after activation, public files are moved into a public
 *   folder served by Nginx.
 * - Items can be deleted any time (even during processing).
 * - Items can be accessed at any point, even when not finished or even started
 *   processing. If multiple queued jobs apply to an item, the item should be
 *   delivered when all jobs complete.
 * - Node might run in a cluster, so dealing with state correctly is important.
 */
class ProcessorQueue {

	/**
	 * Queue definitions. Queues are instantiated based on this list.
	 */
	private readonly queueDefinitions: ProcessorQueueDefinition[] = [
		{ name: 'HI_PRIO_FAST', source: 'original' },
		{ name: 'LOW_PRIO_SLOW', source: 'variation' },
	];

	/**
	 * All available processor instances, accessible by name.
	 */
	private readonly processors: Map<string, Processor<any>> = new Map();

	/**
	 * All available actions, accessible by name.
	 */
	private readonly actions: Map<string, ProcessorAction> = new Map();

	/**
	 * All available processor queues, accessible by name.
	 */
	private readonly queues: Map<string, Queue> = new Map();

	/**
	 * Queue where post actions are executed.
	 */
	private readonly actionQueue: Queue;

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
		for (let type of this.queueDefinitions) {
			const queue = new Bull(type.name, opts);
			queue.process(this.processJob.bind(this));
			this.queues.set(type.name, queue);
		}
		this.actionQueue = new Bull('action.queue', opts);
		this.actionQueue.process(this.processAction.bind(this));

		// create processors
		const processors: Processor<any>[] = [
			new Directb2sOptimizationProcessor(),
			new Directb2sThumbProcessor(),
			new ImageVariationProcessor(),
			new ImageOptimizationProcessor(),
			new VptBlockindexProcessor()
		];
		processors.forEach(p => this.processors.set(p.name, p));

		// create actions
		const actions: ProcessorAction[] = [new ActivateFileAction()];
		actions.forEach(a => this.actions.set(a.name, a));
	}

	/**
	 * Adds a file and its variations to be processed to the corresponding queues.
	 * @param {File} file File to be processed
	 * @param {string} src Path to file
	 * @return {Promise<void>}
	 */
	public async processFile(file: File, src: string): Promise<void> {

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
				logger.debug('[ProcessorQueue.processFile] Added original file %s to queue %s with processor %s (%s).',
					file.toDetailedString(), processor.getQueue(), processor.name, job.id);
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
					logger.debug('[ProcessorQueue.processFile] Added %s to queue %s with processor %s (%s).',
						file.toDetailedString(variation), processor.name, processor.getQueue(), job.id);
					n++;
				}
			}
		}
		if (n === 0) {
			logger.info('[ProcessorQueue.processFile] No processors matched %s or any variation.', file.toDetailedString());
		}
	}

	/**
	 * Subscribes to all queues and returns when the last job and action for
	 * the given file/variation has completed.
	 *
	 * @param {File} file File to match
	 * @param {FileVariation} variation Variation to match. If none given, original is matched
	 * @return {Promise<any>} Resolves with the last job's result or `null` if any actions where executed
	 */
	public async waitForVariationCompletion(file: File, variation: FileVariation|null): Promise<any> {
		return new Promise<any>(resolve => {
			const queues = this.queues;
			const completeListener = (j: Job, result: any) => {
				(async () => {
					const data:JobData = j.data as JobData;

					// if it's not the same variation, abort
					if (!ProcessorQueue.isSame(file.id, variation ? variation.name : null, data.fileId, data.variation)) {
						return;
					}
					// if there are still jobs, abort.
					const numJobs = await this.countRemainingVariationJobs(data.fileId, data.variation);
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForVariationCompletion] Waiting for another %s job(s) to finish for %s.',
							numJobs, file.toString(variation));
						return;
					}
					// unregister listener
					for (let queue of queues.values()) {
						(queue as any).off('completed', completeListener);
					}
					// wait for any actions to be completed
					const numActions = await this.countRemainingActionJobs(data.fileId);
					if (numActions > 0) {
						await this.waitForActionCompletion(file.id);
						result = null;
					}
					logger.debug('[ProcessorQueue.waitForVariationCompletion] Finished waiting for %s.', file.toString(variation));

					// all good!
					resolve(result);
				})();
			};
			for (let queue of this.queues.values()) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Waits until the last job finishes processing.
	 * @returns {Promise<void>}
	 */
	public async waitForAnyCompletion(): Promise<void> {
		const numJobs = await this.countRemainingJobs();
		if (numJobs === 0) {
			return;
		}
		return new Promise<any>(resolve => {
			const queues = this.queues;
			const completeListener = (j: Job, result: any) => {
				(async () => {
					// if there are still jobs, abort.
					const numJobs = await this.countRemainingJobs();
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForAnyCompletion] Waiting for another %s job(s) to complete.', numJobs);
						return;
					}
					// unregister listener
					for (let queue of queues.values()) {
						(queue as any).off('completed', completeListener);
					}
					logger.debug('[ProcessorQueue.waitForAnyCompletion] All jobs done.');
					resolve(result);
				})();
			};
			for (let queue of this.queues.values()) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Adds an action to be executed.
	 * @param {File} file
	 * @param {string} action
	 * @return {Promise<void>}
	 */
	public async addAction(file: File, action: string): Promise<void> {

		const numJobs = await this.countRemainingFileJobs(file.id);
		if (numJobs > 0) {
			// wait for pending processing jobs to complete
			await this.waitForFileCompletion(file.id);
		}
		// add to action queue
		await this.actionQueue.add({ fileId: file.id, action: action });

		// wait for actions for file to complete
		await this.waitForActionCompletion(file.id);
	}

	/**
	 * Removes all waiting jobs for a given file from all queues and deletes
	 * the result of all currently active jobs for the given file.
	 *
	 * @param {File} file File to delete
	 * @return {Promise<void>}
	 */
	public async deleteProcessingFile(file: File): Promise<void> {
		const promises: (() => Bluebird<any> | Promise<any>)[] = [];
		const redisLock = 'queue:delete:' + file.id;
		await state.redis.setAsync(redisLock, '1');
		for (let q of this.queueDefinitions) {
			const queue = this.queues.get(q.name);

			// remove waiting jobs
			const waitingJobs = await queue.getWaiting();
			const waitingJobsForFile = waitingJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (waitingJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Removing %s jobs from queue %s',
					waitingJobsForFile.length, q.name);
				promises.push(...waitingJobsForFile.map(job => () => job.remove()));
			}

			// TODO remove actions

			// wait for active jobs and delete afterwards.
			const activeJobs = await queue.getActive();
			const activeJobsForFile = activeJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (activeJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Cleaning up after %s active job(s) from queue %s.',
					activeJobsForFile.length, q.name);
				promises.push(...activeJobsForFile.map(job => () => this.waitForJobCompletion(q, job)
					.then(path => {
						if (path) {
							logger.info('[ProcessorQueue.deleteProcessingFile] Finally removing %s', path);
							return unlinkAsync(path);
						}
					})));
			}
		}
		// noinspection JSIgnoredPromiseFromCall: do this in the background
		Promise.all(promises.map(fn => fn()))
			.then(() => state.redis.delAsync(redisLock))
			.then(async () => {
				const originalPath = file.getPath(null, { tmpSuffix: '_original' });
				if (await existsAsync(originalPath)) {
					logger.info('[ProcessorQueue.deleteProcessingFile] Finally removing original %s', originalPath);
					await unlinkAsync(originalPath);
				}
			}).catch(err => {
				logger.error('Error while processing finishing up removal:\n\n' + ApiError.colorStackTrace(err));
			});
	}

	/**
	 * Waits until a file variation is first created and returns the path.
	 * @param {File} file
	 * @param {FileVariation} variation
	 * @return {Promise<string>} Path to the processed file
	 */
	private async getCreatedVariation(file: File, variation: FileVariation): Promise<string> {
		const path = file.getPath(variation);
		const numJobs = await this.countRemainingVariationCreationJobs(file.id, variation.name);
		if (numJobs > 0) {
			logger.info('[ProcessorQueue.getProcessedFile] Waiting for %s to finish processing',
				file.toString(variation));
			return await this.waitForVariationCreated(file, variation);
		} else {
			// so it's not an active or waiting job, let's check the file system
			if ((await existsAsync(path)) && (await statAsync(path)).size > 0) {
				logger.info('[ProcessorQueue.getProcessedFile] %s has finished processing',
					file.toString(variation));
				return path;
			}
			throw new ApiError('Cannot find job for %s at %s.', file.toString(variation), path);
		}
	}

	/**
	 * Subscribes to all queues that source the original file and waits until
	 * the given variation has been created.
	 *
	 * @param {File} file File to match
	 * @param {FileVariation} variation Variation to match.
	 * @return {Promise<any>} Resolves with the last job's result.
	 */
	private async waitForVariationCreated(file: File, variation: FileVariation): Promise<any> {
		return new Promise<any>(resolve => {
			const queues = this.getVariationCreationQueues();
			const completeListener = (j: Job, result: any) => {
				(async () => {
					const data:JobData = j.data as JobData;

					// if it's not the same variation, abort
					if (!ProcessorQueue.isSame(file.id, variation ? variation.name : null, data.fileId, data.variation)) {
						return;
					}
					for (let queue of queues) {
						(queue as any).off('completed', completeListener);
					}

					// if the file is being deleted, abort.
					if (await state.redis.getAsync('queue:delete:' + file.id)) {
						logger.debug('[ProcessorQueue.waitForVariationCreated] Aborting wait, %s has been deleted.',
							file.toString(variation));
						resolve(null);
						return;
					}
					logger.debug('[ProcessorQueue.waitForVariationCreated] Finished waiting for %s.',
						file.toString(variation));
					resolve(result);
				})();
			};
			for (let queue of queues) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Subscribes to all queues and returns when the last job for *every*
	 * variation of a given file has completed.
	 *
	 * @param {string} fileId File ID to match
	 */
	private async waitForFileCompletion(fileId: string): Promise<void> {
		return new Promise<void>(resolve => {
			const queues = this.queues;
			const completeListener = (job: Job) => {
				(async () => {
					const data:JobData = job.data as JobData;

					// if it's not the same file, abort
					if (fileId !== data.fileId) {
						return;
					}

					// if there are still jobs, abort.
					const numJobs = await this.countRemainingFileJobs(data.fileId);
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForFileCompletion] Waiting for another %s job(s) to finish for file %s.',
							numJobs, fileId);
						return;
					}
					logger.debug('[ProcessorQueue.waitForFileCompletion] Finished waiting for file %s.', fileId);
					for (let queue of queues.values()) {
						(queue as any).off('completed', completeListener);
					}
					resolve();
				})();
			};
			for (let queue of this.queues.values()) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Waits until all actions for a given file ID have finished.
	 *
	 * @param {string} fileId File ID to match
	 */
	private async waitForActionCompletion(fileId: string): Promise<void> {
		return new Promise<void>(resolve => {
			const completeListener = (job: Job) => {
				(async () => {
					const data:JobData = job.data as JobData;

					// if it's not the same file, abort
					if (fileId !== data.fileId) {
						return;
					}

					// if there are still jobs, abort.
					const numJobs = await this.countRemainingActionJobs(data.fileId);
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForActionCompletion] Waiting for another %s action(s) to for file %s.',
							numJobs, fileId);
						return;
					}
					logger.debug('[ProcessorQueue.waitForActionCompletion] Finished waiting for file %s.', fileId);
					(this.actionQueue as any).off('completed', completeListener);
					resolve();
				})();
			};
			this.actionQueue.on('completed', completeListener);
		});
	}

	/**
	 * Subscribes to the queue of a given job and returns when the job has finished.
	 * @param {ProcessorQueueDefinition} qd Queue to subscribe to
	 * @param {Bull.Job} job Job to wait for
	 * @returns {Promise<any>} Resolves with the job's result.
	 */
	private async waitForJobCompletion(qd: ProcessorQueueDefinition, job: Job): Promise<any> {
		const queue = this.queues.get(qd.name);
		return await new Promise<void>(resolve => {
			logger.debug('[ProcessorQueue.waitForJobCompletion] Waiting for job %s on queue %s to be completed.', job.id, qd.name);
			function completeListener(j: Job, result: any) {
				// if job given and no match, ignore.
				if (job && j.id !== job.id) {
					return;
				}
				logger.debug('[ProcessorQueue.waitForJobCompletion] Finished waiting for job %s on queue %s.', job.id, qd.name);
				(queue as any).off('completed', completeListener);
				resolve(result);
			}
			queue.on('completed', completeListener);
		});
	}

	/**
	 * Counts how many active or waiting jobs there are for a given variation
	 * on original source queues.
	 *
	 * @param {string} fileId File ID
	 * @param {string} variationName Variation name
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingVariationCreationJobs(fileId: string, variationName: string): Promise<number> {
		return this.countRemaining(this.getVariationCreationQueues(),
				job => ProcessorQueue.isSame(job.data.fileId, job.data.variation, fileId, variationName));
	}

	/**
	 * Counts how many active or waiting jobs there are for a given variation.
	 *
	 * @param {string} fileId File ID
	 * @param {string} variationName Variation name
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingVariationJobs(fileId: string, variationName: string): Promise<number> {
		return this.countRemaining([...this.queues.values()],
				job => ProcessorQueue.isSame(job.data.fileId, job.data.variation, fileId, variationName));
	}

	/**
	 * Counts how many active or waiting jobs there are for a given file and
	 * all of its variations.
	 *
	 * @param {string} fileId File ID
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingFileJobs(fileId: string): Promise<number> {
		return this.countRemaining([...this.queues.values()], job => job.data.fileId === fileId);
	}

	/**
	 * Counts how many active or waiting actions there are for a given file.
	 *
	 * @param {string} fileId File ID
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingActionJobs(fileId: string): Promise<number> {
		const jobs = await (this.actionQueue as any).getJobs(['waiting', 'active']) as Job[];
		return jobs.filter(j => j.data.fileId === fileId).length;
	}

	/**
	 * Counts how many active or waiting actions there are for any file.
	 *
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingJobs(): Promise<number> {
		return this.countRemaining([...this.queues.values()],() => true);
	}

	private async countRemaining(queues:Queue[], filter:(job:Job) => boolean) {
		let numbJobs = 0;
		for (let q of queues) {
			const jobs = await (q as any).getJobs(['waiting', 'active']) as Job[];
			const remainingJobs = jobs.filter(filter);
			numbJobs += remainingJobs.length;
		}
		return numbJobs;
	}

	private getVariationCreationQueues():Queue[] {
		return this.queueDefinitions
			.filter(qd => qd.source === 'original')
			.map(qd => this.queues.get(qd.name));
	}

	/**
	 * This is the worker function that is pulled from the queue.
	 * Note that it's executed on one single worker, so not suitable for callback handling.
	 *
	 * @param {Bull.Job} job
	 * @return {Promise<any>}
	 */
	private async processJob(job: Job): Promise<any> {
		let file: File;
		try {
			// retrieve data from deserialized job
			const data = job.data as JobData;
			file = await state.models.File.findOne({ id: data.fileId }).exec();
			if (!file) {
				logger.warn('[ProcessorQueue.processJob] %s/#%s skip: File "%s" has been removed from DB, ignoring.',
					data.processor, job.id, data.fileId);
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
			const queue = this.queueDefinitions.find(q => q.name === processor.getQueue());
			let src: string;
			if (variation && queue.source === 'variation') {
				src = await this.getCreatedVariation(file, variation);
			} else {
				src = data.src;
			}

			// source might not be available anymore (when deleted), in this case abort.
			if (src === null) {
				return null;
			}

			// process to temp file
			logger.debug('[ProcessorQueue.processJob] %s/#%s start: %s at %s',
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
			logger.debug('[ProcessorQueue.processJob] %s/#%s done: %s', data.processor, job.id, file.toDetailedString(variation));

			return file.getPath(variation);

		} catch (err) {
			// nothing to return here because it's in the background.
			logger.error('Error while processing %s with %s:\n\n' + ApiError.colorStackTrace(err) + '\n\n', file ? file.toString() : 'null', job.data.processor);
			// TODO log to raygun
		}
	}

	/**
	 * The worker function for executing actions.
	 *
	 * @param {Bull.Job} job
	 * @return {Promise<any>}
	 */
	private async processAction(job: Job): Promise<any> {
		const actionName: string = job.data.action;
		const fileId: string = job.data.fileId;
		const action = this.actions.get(actionName);
		return await action.run(fileId);
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

	/**
	 * Compares two fileIds and variation names and returns true if they match.
	 * @param {string} fileId1
	 * @param {string} variation1
	 * @param {string} fileId2
	 * @param {string} variation2
	 * @return {boolean}
	 */
	private static isSame(fileId1: string, variation1: string, fileId2: string, variation2: string): boolean {
		// if file ID doesn't match, ignore.
		if (fileId1 !== fileId2) {
			return false;
		}
		// if variation given and no match, ignore.
		if (variation1 && variation1 !== variation2) {
			return false;
		}
		// if no variation given and variation, ignore
		if (!variation1 && variation2) {
			return false;
		}
		return true;
	}
}

/**
 * Whats serialized between the worker and the main thread
 */
interface JobData {
	src: string;
	fileId: string;
	processor: string;
	variation?: string;
}

/**
 * Defines the properties of a queue.
 */
interface ProcessorQueueDefinition {
	/**
	 * Name of the queue. Processors link to that name.
	 */
	name: ProcessorQueueName;

	/**
	 * Source file.
	 *  - If set to `original`, the uploaded file is used, even for variations.
	 *  - If set to `variation`, the variation is awaited and used for variations.
	 */
	source: 'original' | 'variation'
}

export type ProcessorQueueName = 'HI_PRIO_FAST' | 'LOW_PRIO_SLOW';

export const processorQueue = new ProcessorQueue();