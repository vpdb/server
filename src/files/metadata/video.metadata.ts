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
import { pick } from 'lodash';

import { config } from '../../common/settings';
import { File } from '../file';
import { FileDocument } from '../file.document';
import { FileVariation } from '../file.variations';
import { Metadata } from './metadata';
import { RequestState } from '../../common/typings/context';

const ffmpeg = require('bluebird').promisifyAll(Ffmpeg);

export class VideoMetadata extends Metadata {

	constructor() {
		super();
		/* istanbul ignore if */
		if (config.ffmpeg && config.ffmpeg.path) {
			ffmpeg.setFfmpegPath(config.ffmpeg.path);
		}
	}

	public isValid(file: FileDocument, variation?: FileVariation): boolean {
		return File.getMimeCategory(file, variation) === 'video';
	}

	public async getMetadata(requestState: RequestState, file: FileDocument, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		return ffmpeg.ffprobeAsync(path);
	}

	public serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		let short: any = {};
		if (metadata.format) {
			short = pick(metadata.format, ['format_name', 'format_long_name', 'duration', 'bit_rate']);
		}
		if (metadata.streams) {
			metadata.streams.forEach((stream: any) => {
				if (stream.codec_type === 'video' && !short.video) {
					short.video = pick(stream, 'codec_name', 'width', 'height', 'display_aspect_ratio', 'bit_rate');
				}
				if (stream.codec_type === 'audio' && !short.audio) {
					short.video = pick(stream, 'codec_name', 'sample_rate', 'channels', 'bit_rate');
				}
			});
		}
		return short;
	}

	public serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		if (metadata.video) {
			return {
				width: metadata.video.width,
				height: metadata.video.height,
				bit_rate: metadata.video.bit_rate,
				codec_name: metadata.video.codec_name,
			};
		} else {
			return undefined;
		}
	}
}
