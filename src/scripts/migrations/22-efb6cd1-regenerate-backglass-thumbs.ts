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

import { logger } from '../../app/common/logger';
import { FileDocument } from '../../app/files/file.document';
import { BackglassVariation } from '../../app/files/file.variations';
import { processorQueue } from '../../app/files/processor/processor.queue';
import { state } from '../../app/state';

/**
 * Re-processes backglass thumbs that were generated without saturation due to
 * a bug.
 */
export async function up() {

	// migrate releases
	logger.info(null, '[migrate-22] Re-processing backglass thumbs...');
	const backglasses = await state.models.Backglass
		.find({ created_at: {
			$gte: new Date(Date.parse('2017-01-01 00:00:00.000Z')),
			$lte: new Date(Date.parse('2019-05-25 00:00:00.000Z')),
		}})
		.populate({ path: 'versions._file' })
		.exec();

	for (const backglass of backglasses) {
		for (const version of backglass.versions) {
			logger.info(null, '[migrate-22] Re-processing thumbs of backglass %s@%s...', backglass.id, version.version);
			await processorQueue.reprocessFile(null,
				version._file as FileDocument,
				false,
				(variation: BackglassVariation) => !!variation.modulate,
				() => false,
			);
		}
	}

	logger.info(null, '[migrate-22] All done.');
}
