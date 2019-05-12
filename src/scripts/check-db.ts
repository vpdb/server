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

import mongoose from 'mongoose';
import { endPoints } from '../app/common/api.endpoints';
import { logger } from '../app/common/logger';
import { config } from '../app/common/settings';
import { state } from '../app/state';

(async () => {

	try {

		logger.info(null, 'Checking database for coherence...');
		await bootstrapDatabase();

		// games
		const games = await state.models.Game.find({}).exec();
		for (const game of games) {
			assert('Game', game._id, '_backglass', game._backglass, await state.models.File.findById(game._backglass).exec());
			assertOptional('Game', game._id, '_logo', game._logo, await state.models.File.findById(game._logo).exec());
			assert('Game', game._id, '_created_by', game._created_by, await state.models.User.findById(game._created_by).exec());
		}

		// releases
		const releases = await state.models.Release.find({}).exec();
		for (const release of releases) {
			assert('Release', release._id, '_created_by', release._created_by, await state.models.User.findById(release._created_by).exec());
			let i = 0;
			for (const tag of release._tags) {
				assert('Release', release._id, `_tags.${i}`, tag, await state.models.Tag.findById(tag).exec());
				i++;
			}
			i = 0;
			for (const author of release.authors) {
				assert('Release', release._id, `authors.${i}._user`, author._user, await state.models.User.findById(author._user).exec());
				i++;
			}
			i = 0;
			for (const version of release.versions) {
				let j = 0;
				for (const versionFile of version.files) {
					assert('Release', release._id, `versions.${i}.files.${j}._file`, versionFile._file, await state.models.File.findById(versionFile._file).exec());
					assert('Release', release._id, `versions.${i}.files.${j}._playfield_image`, versionFile._playfield_image, await state.models.File.findById(versionFile._playfield_image).exec());
					assertOptional('Release', release._id, `versions.${i}.files.${j}._playfield_video`, versionFile._playfield_video, await state.models.File.findById(versionFile._playfield_video).exec());
					let k = 0;
					for (const build of versionFile._compatibility) {
						assert('Release', release._id, `versions.${i}.files.${j}._compatibility.${k}`, build, await state.models.Build.findById(build).exec());
						k++;
					}
					j++;
				}
				i++;
			}
		}

		logger.info(null, 'Done!');
		process.exit(0);

	} catch (err) {
		console.error(err);
		process.exit(1);

	} finally {
		await closeDatabase();
	}

})();

function assertOptional(parentModel: string, parentId: any, refField: string, refId: any, refResult: any) {
	assert(parentModel, parentId, refField, refId, refResult, true);
}

function assert(parentModel: string, parentId: any, refField: string, refId: any, refResult: any, optional = false) {
	if (!optional && !refId) {
		logger.warn(null, `Reference ${refField} in ${parentModel}:${parentId.toString()} is required but not found.`);

	} else if (refId && !refResult) {
		logger.warn(null, `Reference ${refField}:${refId.toString()} in ${parentModel}:${parentId.toString()} not found.`);
	}
}

async function bootstrapDatabase() {
	await mongoose.connect(config.vpdb.db, { useNewUrlParser: true });
	for (const endPoint of endPoints) {
		endPoint.registerModel();
	}
}

async function closeDatabase() {
	await mongoose.connection.close();
}
