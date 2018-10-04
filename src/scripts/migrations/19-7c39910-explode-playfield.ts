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

import mongoose from 'mongoose';
import { apiCache } from '../../app/common/api.cache';
import { logger } from '../../app/common/logger';

/**
 * This moves _playfield_image as array into _playfield_images and removes the
 * original value (same for _video).
 */
export async function up() {

	const Release = await mongoose.model('Release').collection;
	const releases = await Release.find({}).toArray();

	logger.info(null, '[migrate-19] Exploding playfields of %s releases..', releases.length);
	for (const release of releases) {
		let n = 0;
		const query: any = {};
		for (let i = 0; i < release.versions.length; i++) {
			for (let j = 0; j < release.versions[i].files.length; j++) {
				const versionFile = release.versions[i].files[j];
				if (versionFile._playfield_image) {
					query.$set = query.$set || {};
					query.$unset = query.$unset || {};
					query.$set['versions.' + i + '.files.' + j + '._playfield_images'] = [ versionFile._playfield_image ];
					query.$unset['versions.' + i + '.files.' + j + '._playfield_image'] = '';
					n++;
				}
				if (versionFile._playfield_video) {
					query.$set = query.$set || {};
					query.$unset = query.$unset || {};
					query.$set['versions.' + i + '.files.' + j + '._playfield_videos'] = [ versionFile._playfield_video ];
					query.$unset['versions.' + i + '.files.' + j + '._playfield_video'] = '';
					n++;
				}
			}
		}
		if (n > 0) {
			logger.info(null, '[migrate-19] Exploded %s media references into arrays for release %s.', n, release.id);
			await Release.updateOne({ _id: release._id}, query);
		} else {
			logger.warn(null, '[migrate-19] No playfield media found for release %s.', release.id);
		}
	}

	// invalidate cache
	await apiCache.invalidateAll();
	logger.info(null, '[migrate-19] Cache invalidated.');
}
