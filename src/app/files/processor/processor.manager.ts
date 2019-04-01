/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import Bull, { Job, JobOptions, Queue, QueueOptions } from 'bull';
import { uniq } from 'lodash';

import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { config } from '../../common/settings';
import { RequestState } from '../../common/typings/context';
import { FileDocument } from '../file.document';
import { mimeTypeCategories } from '../file.mimetypes';
import { FileVariation } from '../file.variations';
import { Directb2sOptimizationProcessor } from './directb2s.optimization.processor';
import { Directb2sThumbProcessor } from './directb2s.thumb.processor';
import { ImageOptimizationProcessor } from './image.optimization.processor';
import { ImageVariationProcessor } from './image.variation.processor';
import { CreationProcessor, OptimizationProcessor, Processor } from './processor';
import { JobData, ProcessorQueueType } from './processor.queue';
import { ProcessorWorker } from './processor.worker';
import { VideoOptimizationProcessor } from './video.optimization.processor';
import { VideoScreenshotProcessor } from './video.screenshot.processor';
import { VideoThumbProcessor } from './video.thumb.processor';
import { VptBlockindexProcessor } from './vpt.blockindex.processor';

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
	private readonly creationProcessors: Array<CreationProcessor<any>> = [];

	/**
	 * Optimization processor instances
	 */
	private readonly optimizationProcessors: Array<OptimizationProcessor<any>> = [];

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
				db: config.vpdb.redis.db,
			},
		};

		// define worker function per type
		const workers: Map<ProcessorQueueType, (job: Job) => Promise<any>> = new Map();
		workers.set('creation', ProcessorWorker.create);
		workers.set('optimization', ProcessorWorker.optimize);

		// create queues
		for (const type of processorTypes) {
			this.queues.set(type, new Map());
			for (const category of mimeTypeCategories) {
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
			new VideoThumbProcessor(),
		];
		this.optimizationProcessors = [
			new Directb2sOptimizationProcessor(),
			new ImageOptimizationProcessor(),
			new VideoOptimizationProcessor(),
			new VptBlockindexProcessor(),
		];
	}

	/**
	 * Returns then creation processors for a given file variation.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file File to process
	 * @param {FileVariation} srcVariation Source variation or null if original
	 * @param {FileVariation} destVariation Destination variation
	 * @return {CreationProcessor<any> | null} Processor instances or null if none available
	 */
	public getValidCreationProcessor(requestState: RequestState, file: FileDocument, srcVariation: FileVariation, destVariation: FileVariation): CreationProcessor<any> | null {
		const processors: Array<CreationProcessor<any>> = [];
		for (const processor of this.creationProcessors) {
			if (processor.canProcess(file, srcVariation, destVariation)) {
				processors.push(processor);
			}
		}
		/* istanbul ignore if: Configuration error */
		if (processors.length === 0) {
			logger.warn(requestState, '[ProcessorManager.getValidCreationProcessor] No creation processor found for %s to %s.',
				file.toDetailedString(srcVariation), file.toDetailedString(destVariation));
			return null;
		}
		/* istanbul ignore if: Configuration error */
		if (processors.length > 1) {
			throw new ApiError('Configuration error, found %s creation processors for %s to %s: %s',
				processors.length, file.toDetailedString(srcVariation), file.toDetailedString(destVariation), processors.map(p => p.name).join(', '));
		}
		return processors[0];
	}

	/**
	 * Returns the optimization processors for a given file variation.
	 *
	 * @param {FileDocument} file File to process
	 * @param {FileVariation} [variation=null] Variation or null if original
	 * @return {OptimizationProcessor<any>[]} Processor instances
	 */
	public getValidOptimizationProcessors(file: FileDocument, variation?: FileVariation): Array<OptimizationProcessor<any>> {
		const processors: Array<OptimizationProcessor<any>> = [];
		for (const processor of this.optimizationProcessors) {
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
	 * @param {FileDocument} file File to be processed
	 * @param {FileVariation} variation Variation to be processed
	 * @return {Bull.Queue} Queue instance
	 */
	public getQueue(type: ProcessorQueueType, file: FileDocument, variation: FileVariation): Queue {
		return this.queues.get(type).get(file.getMimeCategory(variation));
	}

	/**
	 * Returns all queues as a flat array.
	 *
	 * @param {FileDocument} [file] If set, only return queues that match any of the file's variation (or the original)
	 * @return {Bull.Queue[]} Queue instances
	 */
	public getQueues(file?: FileDocument) {
		if (!file) {
			return this.allQueues;
		}

		// when file given, return all queues from all categories of the file and its variations
		const queues: Queue[] = [];
		const categories = uniq([file.getMimeCategory(), ...file.getVariations().map(v => file.getMimeCategory(v))]);
		for (const type of processorTypes) {
			for (const category of mimeTypeCategories) {
				if (categories.includes(category)) {
					queues.push(this.queues.get(type).get(category));
				}
			}
		}
		return queues;
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
	 * Adds a file to the creation queue for processing.
	 *
	 * @param requestState For logging
	 * @param {Processor<any>} processor Processor to use
	 * @param {string} srcPath Path to source file
	 * @param {string} destPath Path to destination file
	 * @param {FileDocument} file File to process
	 * @param {FileVariation} srcVariation Source variation
	 * @param {FileVariation} destVariation Destination variation
	 * @returns {Promise<Job>} Added Bull job
	 */
	public async queueCreation(requestState: RequestState, processor: Processor<any>, file: FileDocument, srcPath: string, destPath: string, srcVariation: FileVariation, destVariation: FileVariation): Promise<Job> {
		const queue = this.queues.get('creation').get(file.getMimeCategory(destVariation));
		const jobData = this.getJobData(requestState, processor, file, srcPath, destPath, srcVariation, destVariation);
		const job = await queue.add(jobData, { priority: processor.getOrder(destVariation) } as JobOptions);
		logger.debug(requestState, '[ProcessorManager.queueCreation] Added %s based on %s to creation queue with processor %s (%s).',
			file.toDetailedString(destVariation), file.toDetailedString(srcVariation), processor.name, job.id);
		return job;
	}

	/**
	 * Adds a file to the optimization queue for processing.
	 *
	 * @param requestState For logging
	 * @param {Processor<any>} processor Processor to use
	 * @param {string} srcPath Path to source file
	 * @param {string} destPath Path to destination file
	 * @param {FileDocument} file File to process
	 * @param {FileVariation} variation Variation to optimize
	 * @returns {Promise<Job>} Added Bull job
	 */
	public async queueOptimization(requestState: RequestState, processor: Processor<any>, file: FileDocument, srcPath: string, destPath: string, variation?: FileVariation): Promise<Job> {
		const queue = this.queues.get('optimization').get(file.getMimeCategory(variation));
		const jobData = this.getJobData(requestState, processor, file, srcPath, destPath, variation, variation);
		const job = await queue.add(jobData, { priority: processor.getOrder(variation) } as JobOptions);
		logger.debug(requestState, '[ProcessorManager.queueOptimization] Added %s to optimization queue with processor %s (%s).',
			file.toDetailedString(variation), processor.name, job.id);
		return job;
	}

	/**
	 * Returns the job data object.
	 *
	 * @param requestState For logging
	 * @param processor Processor to use
	 * @param file File to process
	 * @param srcPath Path to source file
	 * @param destPath Path to destination file
	 * @param srcVariation srcVariation Source variation or null if original
	 * @param destVariation destVariation Destination variation
	 */
	public getJobData(requestState: RequestState, processor: Processor<any>, file: FileDocument, srcPath: string, destPath: string, srcVariation?: FileVariation, destVariation?: FileVariation): JobData {
		return {
			fileId: file.id,
			processor: processor.name,
			srcPath,
			destPath,
			requestState,
			srcVariation: srcVariation ? srcVariation.name : undefined,
			destVariation: destVariation ? destVariation.name : undefined,
		};
	}
}

export const processorManager = new ProcessorManager();
