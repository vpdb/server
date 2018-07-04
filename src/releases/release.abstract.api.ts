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

import gm from 'gm';
import { exists } from 'fs';
import { promisify } from 'util';

import { state } from '../state';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { logger } from '../common/logger';
import { File } from '../files/file';
import { FileUtil } from '../files/file.util';
import { Release } from './release';
import { Metadata } from '../files/metadata/metadata';
import { processorQueue } from '../files/processor/processor.queue';

const existsAsync = promisify(exists);
require('bluebird').promisifyAll(gm.prototype);

export abstract class ReleaseAbstractApi extends Api {

	/**
	 * Retrieves release details.
	 * @param id Database ID of the release to fetch
	 * @returns {Promise.<Release>}
	 */
	protected async getDetails(id: string) {
		return state.models.Release.findById(id)
			.populate({ path: '_game' })
			.populate({ path: '_tags' })
			.populate({ path: '_created_by' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._playfield_image' })
			.populate({ path: 'versions.files._playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.populate({ path: 'versions.files.validation._validated_by' })
			.exec();
	}

	/**
	 * Pre-processes stuff before running validations.
	 *
	 * Currently, the only "stuff" is rotation of referenced media.
	 * @param {Context} ctx Koa context
	 * @param {string[]} allowedFileIds Database IDs of file IDs of the current release that are allowed to be preprocessed.
	 * @returns {Promise}
	 */
	protected async preProcess(ctx: Context, allowedFileIds: string[]): Promise<void> {

		if (ctx.query.rotate) {

			// validate input format
			let rotations = this.parseRotationParams(ctx.query.rotate);

			// validate input data
			for (const rotation of rotations) {
				const file = await state.models.File.findOne({ id: rotation.file }).exec();
				if (!file) {
					throw new ApiError('Cannot rotate non-existing file "%s".', rotation.file).status(404);
				}

				if (!allowedFileIds.includes(file._id.toString())) {
					throw new ApiError('Cannot rotate file %s because it is not part of the release (%s).', file.id, file._id).status(400);
				}
				if (file.getMimeCategory() !== 'image') {
					throw new ApiError('Can only rotate images, this is a "%s".', file.getMimeCategory()).status(400);
				}
				if (!['playfield', 'playfield-fs', 'playfield-ws'].includes(file.file_type)) {
					throw new ApiError('Can only rotate playfield images, got "%s".', file.file_type).status(400);
				}
				const src = await this.backupFile(file);

				// do the actual rotation
				if (rotation.angle !== 0) {
					file.preprocessed = file.preprocessed || {};
					file.preprocessed.rotation = file.preprocessed.rotation || 0;
					file.preprocessed.unvalidatedRotation = (file.preprocessed.rotation + rotation.angle + 360) % 360;

					logger.info('[ReleaseApi.preprocess] Rotating file "%s" %s° (was %s° before, plus %s°).', file.getPath(), file.preprocessed.unvalidatedRotation, file.preprocessed.rotation, rotation.angle);

					const img = gm(src);
					img.rotate('black', -file.preprocessed.unvalidatedRotation);
					await (img as any).writeAsync(file.getPath());
				}

				// update metadata
				const metadata = await Metadata.readFrom(file, file.getPath());
				await state.models.File.findByIdAndUpdate(file._id, {
					metadata: metadata,
					file_type: 'playfield-' + (metadata.size.width > metadata.size.height ? 'ws' : 'fs'),
					preprocessed: file.preprocessed
				}).exec();
			}
		}
	}

	/**
	 * Since we need to persist preprocessing changes before validating, we also need a way to
	 * roll them back when validations fail.
	 *
	 * @param {Context} ctx Koa context
	 */
	protected async rollbackPreProcess(ctx: Context): Promise<void> {

		if (ctx.query.rotate) {

			// validate input format
			let rotations = this.parseRotationParams(ctx.query.rotate);

			// validate input data
			for (const rotation of rotations) {
				const file = await state.models.File.findOne({ id: rotation.file }).exec();
				if (!file) {
					throw new ApiError('Cannot rollback non-existing file "%s".', rotation.file).status(404);
				}
				const src = await this.backupFile(file);

				// do the actual rotation
				if (rotation.angle !== 0) {
					delete file.preprocessed.unvalidatedRotation;
					logger.info('[ReleaseApi.rollbackPreprocess] Rolling back rotated file "%s" to %s°.', file.getPath(), file.preprocessed.rotation);
					await (gm(src).rotate('black', file.preprocessed.rotation) as any).writeAsync(file.getPath());
				}

				// update metadata
				const metadata = await Metadata.readFrom(file, file.getPath());
				await state.models.File.findByIdAndUpdate(file._id, {
					metadata: metadata,
					file_type: file.file_type,
					preprocessed: file.preprocessed
				}).exec();
			}
		}
	}

	/**
	 * Runs post-processing on stuff that was pre-processed earlier (and probably
	 * needs to be post-processed again).
	 *
	 * @param {string[]} fileIds Database IDs of the files to re-process.
	 * @returns {Promise}
	 */
	protected async postProcess(fileIds: string[]) {
		logger.info('[ReleaseApi.postprocess] Post-processing files [ %s ]', fileIds.join(', '));
		for (const id of fileIds) {
			const file = await state.models.File.findById(id).exec();
			// so now we're here and unvalidatedRotation is now validated.
			if (file.preprocessed && file.preprocessed.unvalidatedRotation) {
				logger.info('[ReleaseApi.postprocess] Validation passed, setting rotation to %s°', file.preprocessed.unvalidatedRotation);
				await state.models.File.update({ _id: file._id }, {
					preprocessed: { rotation: file.preprocessed.unvalidatedRotation }
				});
			}
			await processorQueue.processFile(file, file.getPath(null, { tmpSuffix: '_original' }));
		}
	}

	/**
	 * Copies a file to a backup location (if not already done) and returns
	 * the file name of the location.
	 *
	 * @param file File
	 * @returns {Promise.<string>} New location
	 */
	private async backupFile(file: File): Promise<string> {
		let backup = file.getPath(null, { tmpSuffix: '_original' });
		if (!(await existsAsync(backup))) {
			logger.info('[ReleaseApi.backupFile] Copying "%s" to "%s".', file.getPath(), backup);
			await FileUtil.cp(file.getPath(), backup);
		}
		return backup;
	}

	/**
	 * Parses the rotation query and throws an exception on incorrect format.
	 *
	 * @param {string} rotate Rotation query from URL
	 * @returns {{ file: string, angle: number }[]} Parsed rotation parameters
	 */
	private parseRotationParams(rotate: string) {
		return rotate.split(',').map(r => {
			if (!r.includes(':')) {
				throw new ApiError('When providing the "rotation" query, pairs must be separated by ":".').status(400);
			}
			let rot = r.split(':');

			if (!['0', '90', '180', '270'].includes(rot[1])) {
				throw new ApiError('Wrong angle "%s", must be one of: [0, 90, 180, 270].', rot[1]).status(400);
			}
			return { file: rot[0], angle: parseInt(rot[1], 10) };
		});
	}
}