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

if (process.env.SQREEN_ENABLED) {
	require('sqreen');
}
import mongoose from 'mongoose';

import { init as initAcls } from './common/acl';
import { endPoints } from './common/api.endpoints';
import { logger } from './common/logger';
import { ModerationSerializer } from './common/mongoose/moderation.serializer';
import { config, settings } from './common/settings';
import { FileUtil } from './files/file.util';
import { server } from './server';
import { state } from './state';

const shortId = require('shortid32');
shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

// links:
//   - https://github.com/Microsoft/TypeScript-Node-Starter
//   - http://brianflove.com/2016/11/11/typescript-2-express-mongoose-mocha-chai/
//   - https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6
(async () => {
	try {
		logger.info(null, '[app] Starting up...');

		// validate settings
		if (!settings.validate()) {
			throw new Error('Settings validation failed.');
		}

		// bootstrap models
		logger.info(null, '[app] Connecting to MongoDB...');
		await mongoose.connect(config.vpdb.db, { useNewUrlParser: true });

		// bootstrap endpoints
		for (const endPoint of endPoints) {
			logger.info(null, '[app] Registering %s:', endPoint.name);
			await server.register(endPoint);
		}

		// global serializers
		state.serializers.Moderation = new ModerationSerializer();

		server.postRegister();

		// setup ACLs
		await initAcls();

		// cleanup inactive storage
		logger.info(null, '[app] Cleaning up inactive storage files older than one week.');
		await FileUtil.cleanup(3600000 * 24 * 7);

		// go!
		server.start();

	} catch (err) {
		/* istanbul ignore next */
		logger.error(null, err);
	}
})();
