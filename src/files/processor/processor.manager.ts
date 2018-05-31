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

import { uniq } from 'lodash';
import Bull, { Job, JobOptions, Queue, QueueOptions } from 'bull';

import { config } from '../../common/settings';
import { logger } from '../../common/logger';
import { ApiError } from '../../common/api.error';
import { File } from '../file';
import { FileVariation } from '../file.variations';
import { mimeTypeCategories } from '../file.mimetypes';
import { CreationProcessor, OptimizationProcessor, Processor } from './processor';
import { ProcessorWorker } from './processor.worker';
import { JobData, ProcessorQueueType } from './processor.queue';
import { Directb2sOptimizationProcessor } from './directb2s.optimization.processor';
import { Directb2sThumbProcessor } from './directb2s.thumb.processor';
import { ImageOptimizationProcessor } from './image.optimization.processor';
import { ImageVariationProcessor } from './image.variation.processor';
import { VideoOptimizationProcessor } from './video.optimization.processor';
import { VptBlockindexProcessor } from './vpt.blockindex.processor';
import { VideoScreenshotProcessor } from './video.screenshot.processor';

export const processorTypes: ProcessorQueueType[] = ['creation', 'optimization'];

/**
 * Handles access to queues and processors.
 *
 * For processor logic, see {@link ProcessorQueue}.
 */
class ProcessorManager {

	/**
	 * Creation processor instances
	 */
	private readonly creationProcessors: CreationProcessor<any>[] = [];

	/**
	 * Optimization processor instances
	 */
	private readonly optimizationProcessors: OptimizationProcessor<any>[] = [];

	/**
	 * Processor queues. There are two queues for every mime category.
	 */
	private readonly queues: Map<ProcessorQueueType, Map<string, Queue>> = new Map();

	/**
	 * A flat list of all processor queues for easy clearing of all jobs
	 */
	private readonly allQueues: Queue[] = [];

	constructor() {

		// redis options
		const opts: QueueOptions = {
			redis: {
				port: config.vpdb.redis.port,
				host: config.vpdb.redis.host,
				db: config.vpdb.redis.db
			}
		};

		// define worker function per type
		const workers: Map<ProcessorQueueType, (job: Job) => Promise<any>> = new Map();
		workers.set('creation', ProcessorWorker.create);
		workers.set('optimization', ProcessorWorker.optimize);

		// create queues
		for (let type of processorTypes) {
			this.queues.set(type, new Map());
			for (let category of mimeTypeCategories) {
				const queue = new Bull(`${type}:${category}`, opts);
				queue.process(workers.get(type));
				this.queues.get(type).set(category, queue);
				this.allQueues.push(queue);
			}
		}

		// create processors
		this.creationProcessors = [
			new Directb2sThumbProcessor(),
			new ImageVariationProcessor(),
			new VideoScreenshotProcessor(),
			new VptBlockindexProcessor()
		];
		this.optimizationProcessors = [
			new Directb2sOptimizationProcessor(),
			new ImageOptimizationProcessor(),
			new VideoOptimizationProcessor()
		];
	}

	/**
	 * Returns then creation processors for a given file variation.
	 *
	 * @param {File} file File to process
	 * @param {FileVariation} srcVariation Source variation or null if original
	 * @param {FileVariation} destVariation Destination variation
	 * @return {CreationProcessor<any> | null} Processor instances or null if none available
	 */
	public getValidCreationProcessor(file: File, srcVariation: FileVariation, destVariation: FileVariation): CreationProcessor<any> | null {
		const processors: CreationProcessor<any>[] = [];
		for (let processor of this.creationProcessors) {
			if (processor.canProcess(file, srcVariation, destVariation)) {
				processors.push(processor);
			}
		}
		if (processors.length === 0) {
			return null;
		}
		if (processors.length > 1) {
			throw new ApiError('Configuration error, found %s creation processors for %s to %s: %s',
				processors.length, file.toDetailedString(srcVariation), file.toDetailedString(destVariation), processors.map(p => p.name).join(', '));
		}
		return processors[0];
	}

	/**
	 * Returns the optimization processors for a given file variation.
	 *
	 * @param {File} file File to process
	 * @param {FileVariation} [variation=null] Variation or null if original
	 * @return {OptimizationProcessor<any>[]} Processor instances
	 */
	public getValidOptimizationProcessors(file: File, variation?: FileVariation): OptimizationProcessor<any>[] {
		const processors: OptimizationProcessor<any>[] = [];
		for (let processor of this.optimizationProcessors) {
			if (processor.canProcess(file, variation)) {
				processors.push(processor);
			}
		}
		return processors;
	}

	/**
	 * Returns the queue for a given type and file variation.
	 *
	 * @param {ProcessorQueueType} type Queue type
	 * @param {File} file File to be processed
	 * @param {FileVariation} variation Variation to be processed
	 * @return {Bull.Queue} Queue instance
	 */
	public getQueue(type: ProcessorQueueType, file: File, variation: FileVariation): Queue {
		return this.queues.get(type).get(file.getMimeCategory(variation));
	}

	/**
	 * Returns all queues as a flat array.
	 *
	 * @param {File} [file] If set, only return queues that match any of the file's variation (or the original)
	 * @return {Bull.Queue[]} Queue instances
	 */
	public getQueues(file?: File) {
		if (!file) {
			return this.allQueues;
		}

		// when file given, return all queues from all categories of the file and its variations
		const queues: Queue[] = [];
		const categories = uniq([file.getMimeCategory(), ...file.getVariations().map(v => file.getMimeCategory(v))]);
		for (let type of processorTypes) {
			for (let category of mimeTypeCategories) {
				if (categories.includes(category)) {
					queues.push(this.queues.get(type).get(category));
				}
			}
		}
		return queues;
	}

	public getCreationQueues(file: File) {
		const queues: Queue[] = [];
		const categories = uniq([file.getMimeCategory(), ...file.getVariations().map(v => file.getMimeCategory(v))]);
		for (let category of mimeTypeCategories) {
			if (categories.includes(category)) {
				queues.push(this.queues.get('creation').get(category));
			}
		}
		return queues;
	}

	public async waitForSrcProcessingFinished(file:File, srcPath:string): Promise<void> {
		const queues = this.getCreationQueues(file);
		const numJobs = await this.countRemainingProcessingWithSrc(queues, srcPath);
		if (numJobs === 0) {
			return;
		}
		return new Promise<void>(resolve => {

			const completeListener = (job: Job) => {
				(async () => {
					const data:JobData = job.data as JobData;

					// if it's not the same path, ignore
					if (data.srcPath !== srcPath) {
						return;
					}

					// if there are still jobs, continue waiting.
					const numJobs = await this.countRemainingProcessingWithSrc(queues, srcPath);
					if (numJobs > 0) {
						logger.debug('[ProcessorQueue.waitForSrcProcessingFinished] Waiting for another %s job(s) to finish for file %s.',
							numJobs, srcPath);
						return;
					}
					logger.debug('[ProcessorQueue.waitForSrcProcessingFinished] Finished waiting for file %s.', srcPath);
					for (let queue of queues.values()) {
						(queue as any).off('completed', completeListener);
					}
					resolve();
				})();
			};
			for (let queue of queues) {
				queue.on('completed', completeListener);
			}
		});
	}

	private async countRemainingProcessingWithSrc(queues: Queue[], srcPath: string):Promise<number> {
		return this.countRemaining(queues, job => job.data.srcPath === srcPath);
	}

	private async countRemaining(queues: Queue[], filter: (job: Job) => boolean):Promise<number> {
		let numbJobs = 0;
		for (let queue of queues) {
			const jobs = await (queue as any).getJobs(['waiting', 'active']) as Job[];
			const remainingJobs = jobs.filter(filter);
			numbJobs += remainingJobs.length;
		}
		return numbJobs;
	}

	/**
	 * Returns a creation processor by name.
	 *
	 * @param {string} name Name of the processor
	 * @return {CreationProcessor<any>} Processor instance
	 */
	public getCreationProcessor(name: string): CreationProcessor<any> {
		return this.creationProcessors.find(p => p.name === name);
	}

	/**
	 * Returns a optimization processor by name.
	 *
	 * @param {string} name Name of the processor
	 * @return {CreationProcessor<any>} Processor instance
	 */
	public getOptimizationProcessor(name: string): OptimizationProcessor<any> {
		return this.optimizationProcessors.find(p => p.name === name);
	}

	/**
	 * Adds a file to the corresponding queue for processing.
	 *
	 * @param {ProcessorQueueType} type Which queue type to add
	 * @param {Processor<any>} processor Processor to use
	 * @param {string} srcPath Path to source file
	 * @param {string} destPath Path to destination file
	 * @param {File} file File to process
	 * @param {FileVariation} srcVariation Source variation (or null for optimizing original)
	 * @param {FileVariation} destVariation Destination variation (or null for optimization)
	 * @returns {Promise<Job>} Added Bull job
	 */
	public async queueFile(type: ProcessorQueueType, processor: Processor<any>, file: File, srcPath: string, destPath: string, srcVariation?: FileVariation, destVariation?: FileVariation): Promise<Job> {
		const queue = this.queues.get(type).get(file.getMimeCategory(srcVariation));
		const job = await queue.add({
			fileId: file.id,
			processor: processor.name,
			srcPath: srcPath,
			destPath: destPath,
			srcVariation: srcVariation ? srcVariation.name : undefined,
			destVariation: destVariation ? destVariation.name : undefined
		} as JobData, {
			priority: processor.getOrder(destVariation || srcVariation),
			// removeOnComplete: true,
			// removeOnFail: true
		} as JobOptions);
		if (destVariation) {
			logger.debug('[ProcessorManager.createJob] Added %s based on %s to %s queue with processor %s (%s).',
				file.toDetailedString(destVariation), file.toDetailedString(srcVariation), type, processor.name, job.id);
		} else {
			logger.debug('[ProcessorManager.createJob] Added %s to %s queue with processor %s (%s).',
				file.toDetailedString(srcVariation), type, processor.name, job.id);
		}
		return job;
	}
}

export const processorManager = new ProcessorManager();