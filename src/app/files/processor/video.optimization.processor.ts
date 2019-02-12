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

import Ffmpeg from 'fluent-ffmpeg';
import { ApiError } from '../../common/api.error';
import { logger } from '../../common/logger';
import { config } from '../../common/settings';
import { RequestState } from '../../common/typings/context';
import { FileDocument } from '../file.document';
import { VideoFileVariation } from '../file.variations';
import { VideoMetadata } from '../metadata/video.metadata';
import { OptimizationProcessor } from './processor';

const ffmpeg = require('bluebird').promisifyAll(Ffmpeg);

export class VideoOptimizationProcessor implements OptimizationProcessor<VideoFileVariation> {

	public name: string = 'video.optimization';

	private metadataReader = new VideoMetadata();

	constructor() {
		if (config.ffmpeg && config.ffmpeg.path) {
			ffmpeg.setFfmpegPath(config.ffmpeg.path);
		}
	}

	public canProcess(file: FileDocument, variation?: VideoFileVariation): boolean {
		return !variation && file.getMimeCategory() === 'video';
	}

	public modifiesFile(): boolean {
		return true;
	}

	public getOrder(variation?: VideoFileVariation): number {
		return 500;
	}

	public async process(requestState: RequestState, file: FileDocument, src: string, dest: string, variation?: VideoFileVariation): Promise<string> {
		return new Promise<string>((resolve, reject) => {

			logger.info(requestState, '[VideoOptimizationProcessor] Starting video processing of %s', file.toShortString(variation));
			if (!variation) {
				const md = this.metadataReader.serializeDetailed(file.metadata);
				if (md.video.bit_rate < 4000000 && /^[hx]264$/.test(md.video.codec_name)) {
					logger.info(requestState, '[VideoOptimizationProcessor] Original video seems okay (%s mpbs, %s), skipping re-processing.', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
					return resolve(null);
				} else {
					logger.info(requestState, '[VideoOptimizationProcessor] Re-processing original video (%s mpbs, %s)', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
				}
			}
			const started = Date.now();
			const proc = ffmpeg(src)
				.noAudio()
				.videoCodec('libx264')
				.on('start', (commandLine: string) => {
					logger.info(requestState, '[VideoOptimizationProcessor] > %s', commandLine);
				})
				.on('error', (err: Error, stdout: string, stderr: string) => {
					logger.error(requestState, '[VideoOptimizationProcessor] ' + err);
					logger.error(requestState, '[VideoOptimizationProcessor] [ffmpeg|stdout] ' + stdout);
					logger.error(requestState, '[VideoOptimizationProcessor] [ffmpeg|stderr] ' + stderr);
					reject(new ApiError('Error processing video').log(err));
				})
				.on('progress', (progress: { percent: number }) => {
					if (progress.percent) {
						logger.info(requestState, '[VideoOptimizationProcessor] Processing %s: %s%', file.toShortString(variation), Math.round(progress.percent * 100) / 100);
					}
				})
				.on('end', () => {
					logger.info(requestState, '[VideoOptimizationProcessor] Transcoding succeeded after %dms, written to %s', Date.now() - started, dest);
					resolve(dest);
				});
			if (variation && variation.height && variation.width) {
				proc.size(variation.height + 'x' + variation.width);
			}
			if (variation && variation.rotate) {
				proc.videoFilters('transpose=2');
			}
			proc.save(dest);
		});
	}
}
