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

import { CreationProcessor } from './processor';
import { File } from '../file';
import { logger } from '../../common/logger';
import { FileVariation, VideoFileVariation } from '../file.variations';
import { ApiError } from '../../common/api.error';
import { config } from '../../common/settings';

const ffmpeg = require('bluebird').promisifyAll(Ffmpeg);

export class VideoScreenshotProcessor implements CreationProcessor<VideoFileVariation> {

	name: string = 'video.screenshot';

	constructor() {
		if (config.ffmpeg && config.ffmpeg.path) {
			ffmpeg.setFfmpegPath(config.ffmpeg.path);
		}
	}

	canProcess(file: File, srcVariation: FileVariation, destVariation: VideoFileVariation): boolean {
		return file.getMimeTypePrimary(srcVariation) === 'video' && destVariation.screenshot;
	}

	getOrder(variation?: FileVariation): number {
		return 100 + (variation && variation.priority ? variation.priority : 0);
	}

	async process(file: File, src: string, dest: string, variation?: VideoFileVariation): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			logger.debug('[VideoScreenshotProcessor] Starting processing %s at %s.', file.toShortString(variation), dest);
			const started = Date.now();
			ffmpeg(src)
				.noAudio()
				.frames(1)
				.seek(variation.position || '0:01')
				.on('start', (commandLine: string) => {
					logger.debug('[VideoScreenshotProcessor] > %s', commandLine);
				})
				.on('error', (err: Error, stdout: string, stderr: string) => {
					logger.error('[VideoScreenshotProcessor] %s', err);
					logger.error('[VideoScreenshotProcessor] [ffmpeg|stdout] %s', stdout);
					logger.error('[VideoScreenshotProcessor] [ffmpeg|stderr] %s', stderr);
					reject(new ApiError('Error processing video').log(err));
				})
				.on('progress', (progress: { percent: number, currentKbps: number }) => {
					logger.debug('[VideoScreenshotProcessor] Processing: %s% at %skbps', progress.percent, progress.currentKbps);
				})
				.on('end', () => {
					logger.debug('[VideoScreenshotProcessor] Transcoding succeeded after %dms, written to %s', new Date().getTime() - started, dest);
					resolve(dest);
				})
				.save(dest);
		});
	}
}
