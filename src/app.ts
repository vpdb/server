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

import { init as initAcls } from './common/acl';
import { EndPoint } from './common/api.endpoint';
import { logger } from './common/logger';
import { config, settings } from './common/settings';
import { server } from './server';

import { AuthenticationEndPoint, AuthenticationStorageEndPoint } from './authentication';
import { BackglassEndPoint } from './backglasses';
import { BuildApiEndPoint } from './builds';
import { CommentEndPoint } from './comments';
import { FilesApiEndPoint, FilesProtectedStorageEndPoint, FilesPublicStorageEndPoint } from './files';
import { GameRequestApiEndPoint } from './game-requests';
import { GamesApiEndPoint } from './games';
import { LogEventEndPoint } from './log-event';
import { LogUserEndPoint } from './log-user';
import { MediaApiEndPoint } from './media';
import { MiscEndPoint } from './misc';
import { ProfileEndPoint } from './profile';
import { RatingEndPoint } from './ratings';
import { ReleaseEndPoint, ReleaseStorageEndPoint } from './releases';
import { RomApiEndPoint } from './roms';
import { StarEndPoint } from './stars';
import { TagApiEndPoint } from './tags';
import { TokenEndPoint } from './tokens';
import { UserEndPoint } from './users';

const shortId = require('shortid32');
shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

// links:
//   - https://github.com/Microsoft/TypeScript-Node-Starter
//   - http://brianflove.com/2016/11/11/typescript-2-express-mongoose-mocha-chai/
//   - https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6
(async () => {
	try {
		logger.info('[app] Starting up...');

		// validate settings
		if (!settings.validate()) {
			throw new Error('Settings validation failed.');
		}

		const endPoints: EndPoint[] = [
			new AuthenticationEndPoint(),
			new AuthenticationStorageEndPoint(),
			new BackglassEndPoint(),
			new BuildApiEndPoint(),
			new CommentEndPoint(),
			new FilesApiEndPoint(),
			new FilesPublicStorageEndPoint(),
			new FilesProtectedStorageEndPoint(),
			new GamesApiEndPoint(),
			new GameRequestApiEndPoint(),
			new LogEventEndPoint(),
			new LogUserEndPoint(),
			new MediaApiEndPoint(),
			new MiscEndPoint(),
			new ProfileEndPoint(),
			new RatingEndPoint(),
			new ReleaseEndPoint(),
			new ReleaseStorageEndPoint(),
			new RomApiEndPoint(),
			new StarEndPoint(),
			new TagApiEndPoint(),
			new TokenEndPoint(),
			new UserEndPoint(),
		];

		// bootstrap models
		logger.info('[app] Connecting to MongoDB...');
		await mongoose.connect(config.vpdb.db);

		// bootstrap endpoints
		for (const endPoint of endPoints) {
			logger.info('[app] Registering %s:', endPoint.name);
			await server.register(endPoint);
		}
		server.postRegister();

		// setup ACLs
		await initAcls();

		// go!
		server.start();

	} catch (err) {
		/* istanbul ignore next */
		logger.error(err);
	}
})();
