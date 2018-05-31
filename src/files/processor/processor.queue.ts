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

import { exists, rename, stat, unlink } from 'fs';
import { promisify } from 'util';
import Bull, { Job, Queue } from 'bull';
import Bluebird from 'bluebird';

import { state } from '../../state';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { File } from '../file';
import { FileVariation } from '../file.variations';
import { processorManager } from './processor.manager';

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
 * A *processor* is a class that takes in a file from the disk and produces a
 * new or optimized version of the file on the disk.
 *
 * We distinguish between *creation* processors and *optimization processors*.
 * Creation processor produce *new variations* of the file, while the latter
 * update the same file with an optimized version.
 *
 * A variation can have the same or a different MIME type than the original.
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
 *   processing. In this case the socket is kept alive until the first version
 *   of the item is available.
 * - A variation might gets produced based on anther variation. For example,
 *   the backglass image from a DirectB2S file is extracted from the original,
 *   while its thumbs are generated from the extracted image.
 * - Node might run in a cluster, so dealing with state correctly is important.
 */
class ProcessorQueue {

	/**
	 * Adds a file and its variations to be processed to the corresponding queues.
	 * @param {File} file File to be processed
	 * @param {string} srcPath Path to source file
	 * @return {Promise<void>}
	 */
	public async processFile(file: File, srcPath: string): Promise<void> {

		// match processors against file variations
		let n = 0;

		// add variations creation queue
		for (let variation of file.getVariations().filter(v => !v.source)) {
			const processor = processorManager.getValidCreationProcessor(file, null, variation);
			if (processor) {
				const destPath = file.getPath(variation, { tmpSuffix: '_' + processor.name + '.processing' });
				await processorManager.queueFile('creation', processor, file, srcPath, destPath, null, variation);
				n++;
			}
		}

		// add original to optimization queue
		for (let processor of processorManager.getValidOptimizationProcessors(file)) {
			const destPath = file.getPath(null, { tmpSuffix: '_' + processor.name + '.processing' });
			await processorManager.queueFile('optimization', processor, file, srcPath, destPath);
			n++;
		}

		if (n === 0) {
			logger.info('[ProcessorQueue.processFile] No processors matched %s.', file.toDetailedString());
		}
	}

	/**
	 * Subscribes to the creation queue and returns when the variation has been created.
	 *
	 * @param {File} file File to match
	 * @param {FileVariation} variation Variation to match. If none given, original is matched
	 * @return {Promise<any>} Resolves with the last job's result or `null` if any actions where executed
	 */
	public async waitForVariationCreation(file: File, variation: FileVariation | null): Promise<any> {

		// fail fast if no jobs running
		const hasJob = await this.hasRemainingCreationJob(file, variation);
		if (!hasJob) {
			throw new ApiError('There is currently no creation job for %s running.', file.toShortString(variation));
		}

		return new Promise<any>(resolve => {
			const queue = processorManager.getQueue('creation', file, variation);
			const completeListener = (j: Job, result: any) => {
				(async () => {
					const data: JobData = j.data as JobData;

					// if it's not the same variation, abort
					if (!ProcessorQueue.isSame(data, file.id, variation ? variation.name : null)) {
						return;
					}
					// unregister listener
					(queue as any).off('completed', completeListener);

					logger.debug('[ProcessorQueue.waitForVariationCreation] Finished waiting for %s.', file.toShortString(variation));

					// all good!
					resolve(result);
				})();
			};
			queue.on('completed', completeListener);
		});
	}

	/**
	 * Waits until the last job finishes processing.
	 * @returns {Promise<void>}
	 */
	public async waitForLastJob(): Promise<void> {
		const numJobs = await this.countRemainingJobs();
		if (numJobs === 0) {
			return;
		}
		return new Promise<any>(resolve => {
			const queues = processorManager.getQueues();
			const completeListener = (j: Job, result: any) => {
				(async () => {
					// if there are still jobs, abort.
					const numJobs = await this.countRemainingJobs();
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForAnyCompletion] Waiting for another %s job(s) to complete.', numJobs);
						return;
					}
					// unregister listener
					for (let queue of queues) {
						(queue as any).off('completed', completeListener);
					}
					logger.debug('[ProcessorQueue.waitForAnyCompletion] All jobs done.');
					resolve(result);
				})();
			};
			for (let queue of queues) {
				queue.on('completed', completeListener);
			}
		});
	}

	/**
	 * Removes all waiting jobs for a given file from all queues and deletes
	 * the result of all currently active jobs for the given file.
	 *
	 * @param {File} file File to delete
	 * @return {Promise<void>}
	 */
	public async deleteProcessingFile(file: File): Promise<void> {
		const redisLock = 'queue:delete:' + file.id;
		const promises: (() => Bluebird<any> | Promise<any>)[] = [];
		await state.redis.setAsync(redisLock, '1');
		for (let queue of processorManager.getQueues(file)) {

			// remove waiting jobs
			const waitingJobs = await queue.getWaiting();
			const waitingJobsForFile = waitingJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (waitingJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Removing %s jobs from queue %s',
					waitingJobsForFile.length, (queue as any).name);
				promises.push(...waitingJobsForFile.map(job => () => job.remove().then(() => {
					if (job.data.destVariation) {
						const variation = file.getVariation(job.data.destVariation);
						if (variation.source) {
							logger.info('[ProcessorQueue.deleteProcessingFile] Removing copied source at %s', job.data.srcPath);
							return unlinkAsync(job.data.srcPath);
						}
					}
				})));
			}

			// announce to active jobs
			const activeJobs = await queue.getActive();
			const activeJobsForFile = activeJobs.filter(job => (job.data as JobData).fileId === file.id);
			if (activeJobsForFile.length) {
				logger.info('[ProcessorQueue.deleteProcessingFile] Cleaning up after %s active job(s) from queue %s.',
					activeJobsForFile.length, (queue as any).name);
				promises.push(...activeJobsForFile.map(job => () => this.waitForJobCompletion(queue, job)));
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
			logger.warn('[ProcessorQueue.deleteProcessingFile] Error while processing finishing up removal: %s', err.message);
		});
	}

	/**
	 * Moves files to the public directory.
	 *
	 * This gets tricky when there are active jobs running on a file that
	 * should be renamed. For example:
	 *
	 * - Optimization job of variation A is active
	 * - At the same time, variation B uses A as source (A's original copy)
	 * - Variation C is queued to use variation B as well
	 * - B might finish before A is finished.
	 *
	 * Problem:
	 * - Cannot rename A upon completion because B or C might still be using it
	 *
	 * Solution:
	 * - After an optimization is done, we actually check whether there are any
	 *   active or waiting creation jobs using the original source before
	 *   overwriting it. So we wait until all creation jobs using the source
	 *   finish before renaming.
	 * - Before renaming, we check in any case if the destination changed (i.e.
	 *   the file was activated) which could also have happened without any
	 *   dependent jobs during optimization.
	 * - If that's the case, rename directly to activated path (and cleanup the
	 *   source on the old path).
	 *
	 * Note that additional optimization jobs will always run after, because
	 * by definition they run as the same MIME category on the same queue and
	 * will be delayed until the file is activated.
	 *
	 * Also note that *all* optimization jobs for that category will be delayed
	 * until the depending creation jobs finish. This is hard to avoid without
	 * delegating the rename operation of the optimize processor to the
	 * depending creation jobs, which will significantly complicate things.
	 *
	 * The drawback however is acceptable, because files are already available
	 * in their non-optimized version, thus the optimizer jobs are not time-
	 * critical.
	 *
	 * @param {File} file File with is_active set to true
	 * @returns {Promise<void>}
	 */
	public async activateFile(file:File): Promise<void> {

		const now = Date.now();

		// map old path -> new path of all variations and original
		const changes: Map<string, string> = new Map();
		if (file.getPath() !== file.getPath(null, { forceProtected: true })) {
			changes.set(file.getPath(null, { forceProtected: true }), file.getPath());
		}
		file.getVariations()
			.filter(v => file.getPath(v) !== file.getPath(v, { forceProtected: true }))
			.forEach(v => changes.set(file.getPath(v, { forceProtected: true }), file.getPath(v)));

		// active jobs get new destPath announcement
		for (let queue of processorManager.getQueues(file)) {
			const jobs = (await queue.getActive()).filter(job => job.data.fileId === file.id);
			for (let job of jobs) {
				const variation = file.getVariation(job.data.destVariation);
				const destPath = file.getPath(variation, { forceProtected: true });
				if (changes.has(destPath)) {
					await state.redis.setAsync('queue:rename:' + destPath, changes.get(destPath));
					changes.delete(destPath);
				}
			}
		}

		// waiting jobs get srcPath updated
		for (let queue of processorManager.getQueues(file)) {
			const jobs = (await queue.getWaiting()).filter(job => job.data.fileId === file.id);
			for (let job of jobs) {
				const data = job.data as JobData;
				// we only care about the source, because the final destination comes from the database when the worker starts
				if (changes.has(data.srcPath)) {
					data.srcPath = changes.get(data.srcPath);
					await job.update(data);
				}
			}
		}

		// now wait for all jobs with a changing source to finish

		// finally, rename remaining files.
	}

	/**
	 * Subscribes to the queue of a given job and returns when the job has finished.
	 * @param {Queue} queue Queue to subscribe to
	 * @param {Bull.Job} job Job to wait for
	 * @returns {Promise<any>} Resolves with the job's result.
	 */
	private async waitForJobCompletion(queue: Queue, job: Job): Promise<any> {
		return await new Promise<void>(resolve => {
			logger.debug('[ProcessorQueue.waitForJobCompletion] Waiting for job %s on queue %s to be completed.', job.id, (queue as any).name);

			function completeListener(j: Job, result: any) {
				// if job given and no match, ignore.
				if (job && j.id !== job.id) {
					return;
				}
				logger.debug('[ProcessorQueue.waitForJobCompletion] Finished waiting for job %s on queue %s.', job.id, (queue as any).name);
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
	// private async countRemainingVariationCreationJobs(fileId: string, variationName: string): Promise<number> {
	// 	return this.countRemaining(this.getVariationCreationQueues(),
	// 			job => ProcessorQueue.isSame(job.data, fileId, variationName));
	// }

	/**
	 * Checks whether there is a creation job active or waiting for a given file variation.
	 *
	 * @param {string} file File
	 * @param {string} variation Variation
	 * @return {Promise<boolean>} True if there is a non-finished job, false otherwise.
	 */
	private async hasRemainingCreationJob(file: File, variation: FileVariation): Promise<boolean> {
		const numJobs = await this.countRemaining([processorManager.getQueue('creation', file, variation)],
			job => ProcessorQueue.isSame(job.data, file.id, variation.name));
		return numJobs > 0;
	}

	/**
	 * Counts how many active or waiting jobs there are for a given file and
	 * all of its variations.
	 *
	 * @param {string} fileId File ID
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	// private async countRemainingFileJobs(fileId: string): Promise<number> {
	// 	return this.countRemaining([...this.queues.values()], job => job.data.fileId === fileId);
	// }

	/**
	 * Counts how many active or waiting actions there are for a given file.
	 *
	 * @param {string} fileId File ID
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	// private async countRemainingActionJobs(fileId: string): Promise<number> {
	// 	const jobs = await (this.actionQueue as any).getJobs(['waiting', 'active']) as Job[];
	// 	return jobs.filter(j => j.data.fileId === fileId).length;
	// }

	/**
	 * Counts how many active or waiting actions there are for any file.
	 *
	 * @return {Promise<number>} Number of non-finished jobs
	 */
	private async countRemainingJobs(): Promise<number> {
		return this.countRemaining(processorManager.getQueues(), () => true);
	}

	private async countRemaining(queues: Queue[], filter: (job: Job) => boolean) {
		let numbJobs = 0;
		for (let q of queues) {
			const jobs = await (q as any).getJobs(['waiting', 'active']) as Job[];
			const remainingJobs = jobs.filter(filter);
			numbJobs += remainingJobs.length;
		}
		return numbJobs;
	}

	/**
	 * Compares two fileIds and variation names and returns true if they match.
	 * @param jobData Job data to compare
	 * @param {string} fileId2
	 * @param {string} variation2
	 * @return {boolean}
	 */
	private static isSame(jobData: JobData, fileId2: string, variation2: string): boolean {
		// if file ID doesn't match, ignore.
		if (jobData.fileId !== fileId2) {
			return false;
		}
		// if variation given and no match, ignore.
		if (jobData.destVariation && jobData.destVariation !== variation2) {
			return false;
		}
		// if no variation given and variation, ignore
		if (!jobData.destVariation && variation2) {
			return false;
		}
		return true;
	}
}

/**
 * Whats serialized between the worker and the main thread
 */
export interface JobData {
	fileId: string;
	processor: string;
	srcPath: string;
	destPath: string;
	srcVariation?: string;
	destVariation?: string;
}

export type ProcessorQueueType = 'creation' | 'optimization';
export const processorQueue = new ProcessorQueue();