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

import { stat } from 'fs';
import { promisify } from 'util';

import { apiCache } from '../../app/common/api.cache';
import { logger } from '../../app/common/logger';
import { FileUtil } from '../../app/files/file.util';
import { processorQueue } from '../../app/files/processor/processor.queue';
import { state } from '../../app/state';

const statAsync = promisify(stat);

/**
 * Re-generates all missing GLB files or updates metadata for existing ones.
 */
export async function up() {

	// create GLB variations
	const mimeType = 'application/x-visual-pinball-table-x';
	const variationName = 'gltf';
	const files = await state.models.File.find({ mime_type : mimeType }).exec();
	for (const file of files) {

		const variation = file.getVariation(variationName);
		const destPath = file.getPath(null, variation);

		// if file exists, just update metadata
		if (await FileUtil.exists(destPath)) {
			logger.info(null, '[migrate-20] Updating metadata for file %s', destPath);

			// update metadata
			const commonMetadata: any = {
				bytes: (await statAsync(destPath)).size,
				mime_type: variation.mimeType,
			};
			const fileData = { [`variations.${variation.name}`]: commonMetadata };
			await state.models.File.findOneAndUpdate({ _id: file._id }, { $set: fileData }).exec();

		// otherwise re-process
		} else {
			logger.info(null, '[migrate-20] Reprocessing file at %s...', destPath);
			try {
				await processorQueue.reprocessFile(null, file, false,
					v => v.name === variationName,
					() => false);
			} catch (err) {
				logger.error(null, '[migrate-20] Failed reprocessing: %s', err.message);
			}
		}
	}

	// clear all caches
	await apiCache.invalidateAll();
	logger.info(null, '[migrate-20] Cache invalidated.');
}
