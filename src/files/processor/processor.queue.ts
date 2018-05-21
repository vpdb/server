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

import { rename } from 'fs';
import { promisify } from 'util';
import { sep } from 'path';
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

const renameAsync = promisify(rename);

class ProcessorQueue {

	private queues: Map<string, Queue> = new Map();
	private processors: Map<string, Processor<any>> = new Map();

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
		for (let type in ProcessorQueueType) {
			const queue = new Bull(type, opts);
			queue.process(this.processJob.bind(this));
			this.queues.set(type, queue);
		}

		// create processors
		const processors: Processor<any>[] = [new ImageVariationProcessor(), new ImageOptimizationProcessor()];
		processors.forEach(p => this.processors.set(p.name, p));
	}

	public async processFile(file: File, src: string): Promise<any> {

		let n = 0;

		// match processors against file variations
		for (let processor of this.processors.values()) {

			// first, add jobs for original file
			if (processor.canProcess(file)) {
				const job = await this.queues.get(processor.getQueue().toString()).add(this.getJobData(file, src, processor), {
					priority: processor.getOrder()
				} as JobOptions);
				logger.debug('[queue] Added original file %s (%s/%s) to queue (%s).', file.id, file.file_type, file.mime_type, job.id);
				n++;
			}

			// then for each variation
			for (let variation of file.getVariations()) {
				if (processor.canProcess(file, variation)) {
					const job = await this.queues.get(processor.getQueue().toString()).add(this.getJobData(file, src, processor, variation), {
						priority: processor.getOrder(variation)
					} as JobOptions);
					logger.debug('[QueueProcessor.processFile] Added %s variation %s of file %s (%s/%s) to queue (%s).', variation.name, file.id, file.file_type, file.mime_type, job.id);
					n++;
				}
			}
		}
		if (n === 0) {
			logger.info('[QueueProcessor.processFile] No processors matched the file or any variation.');
		}
	}

	private getJobData(file: File, src: string, processor: Processor<any>, variation?: FileVariation): JobData {
		return {
			src: src,
			fileId: file.id,
			processor: processor.name,
			variation: variation ? variation.name : undefined
		}
	}

	private async processJob(job: Job): Promise<any> {

		// retrieve data from deserialized job
		const data = job.data as JobData;
		const file = await state.models.File.findOne({ id: data.fileId }).exec();
		const processor = this.processors.get(data.processor);
		const variation = fileTypes.getVariation(file.file_type, file.mime_type, data.variation);

		const tmpPath = file.getPath(variation, { tmpSuffix: '_processing' });
		const tmpPathLog = tmpPath.split(sep).slice(-3).join('/');
		const pathLog = file.getPath(variation).split(sep).slice(-3).join('/');
		// process to temp file
		logger.debug('[QueueProcessor.processJob] Start: %s at %s...', file.toDetailedString(variation), tmpPathLog);
		await processor.process(file, data.src, tmpPath, variation);

		// update metadata

		// rename
		logger.debug('[QueueProcessor.processJob] Done: %s, renaming to back to %s.', file.toDetailedString(variation), pathLog);
		await renameAsync(tmpPath, file.getPath(variation));
		logger.debug('[QueueProcessor.processJob] Done: %s.', file.toDetailedString(variation));
	}
}

interface JobData {
	src: string;
	fileId: string;
	processor: string;
	variation?: string;
}

export enum ProcessorQueueType {
	HI_PRIO_FAST,
	LOW_PRIO_SLOW
}

export const processorQueue = new ProcessorQueue();