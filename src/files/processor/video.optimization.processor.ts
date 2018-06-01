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
import Ffmpeg from 'fluent-ffmpeg';
import { OptimizationProcessor } from './processor';
import { File } from '../file';
import { logger } from '../../common/logger';
import { VideoFileVariation } from '../file.variations';
import { ApiError } from '../../common/api.error';
import { VideoMetadata } from '../metadata/video.metadata';
import { config } from '../../common/settings';

const ffmpeg = require('bluebird').promisifyAll(Ffmpeg);

export class VideoOptimizationProcessor implements OptimizationProcessor<VideoFileVariation> {

	name: string = 'video.optimization';

	private metadataReader = new VideoMetadata();

	constructor() {
		if (config.ffmpeg && config.ffmpeg.path) {
			ffmpeg.setFfmpegPath(config.ffmpeg.path);
		}
	}

	canProcess(file: File, variation?: VideoFileVariation): boolean {
		return file.getMimeCategory(variation) === 'video';
	}

	getOrder(variation?: VideoFileVariation): number {
		return 500;
	}

	async process(file: File, src: string, dest: string, variation?: VideoFileVariation): Promise<string> {
		return new Promise<string>((resolve, reject) => {

			logger.info('[VideoOptimizationProcessor] Starting video processing of %s', file.toShortString(variation));
			if (!variation) {
				const md = this.metadataReader.serializeDetailed(file.metadata);
				if (md.video.bit_rate < 4000000 && /^[hx]264$/.test(md.video.codec_name)) {
					logger.info('[VideoOptimizationProcessor] Original video seems okay (%s mpbs, %s), skipping re-processing.', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
					return resolve(dest);
				} else {
					logger.info('[VideoOptimizationProcessor] Re-processing original video (%s mpbs, %s)', Math.round(md.video.bit_rate / 1000) / 1000, md.video.codec_name);
				}
			}
			const started = Date.now();
			const proc = ffmpeg(src)
				.noAudio()
				.videoCodec('libx264')
				.on('start', function (commandLine: string) {
					logger.info('[VideoOptimizationProcessor] > %s', commandLine);
				})
				.on('error', function (err: Error, stdout: string, stderr: string) {
					logger.error('[VideoOptimizationProcessor] ' + err);
					logger.error('[VideoOptimizationProcessor] [ffmpeg|stdout] ' + stdout);
					logger.error('[VideoOptimizationProcessor] [ffmpeg|stderr] ' + stderr);
					reject(new ApiError('Error processing video').log(err));
				})
				.on('progress', function (progress: { percent: number }) {
					if (progress.percent) {
						logger.info('[VideoOptimizationProcessor] Processing %s: %s%', file.toShortString(variation), Math.round(progress.percent * 100) / 100);
					}
				})
				.on('end', function () {
					logger.info('[VideoOptimizationProcessor] Transcoding succeeded after %dms, written to %s', Date.now() - started, dest);
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