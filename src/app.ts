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

import { server } from './server';
import { config } from './common/settings';
import { init as initAcls } from './common/acl';
import { logger } from './common/logger';
import { EndPoint } from './common/types/endpoint';

import { AuthenticationEndPoint } from './authentication';
import { FilesApiEndPoint, FilesStorageEndPoint } from './files';
import { LogEventEndPoint } from './log-event';
import { LogUserEndPoint } from './log-user';
import { TokenEndPoint } from './tokens';
import { MiscEndPoint } from './misc';
import { ProfileEndPoint } from './profile';
import { ReleaseEndPoint } from './releases';
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

		const endPoints: EndPoint[] = [
			new AuthenticationEndPoint(),
			new FilesApiEndPoint(),
			new FilesStorageEndPoint(),
			new LogEventEndPoint(),
			new LogUserEndPoint(),
			new MiscEndPoint(),
			new ProfileEndPoint(),
			new ReleaseEndPoint(),
			new TokenEndPoint(),
			new UserEndPoint(),
		];

		// bootstrap models
		logger.info('[app] Connecting to MongoDB...');
		await mongoose.connect(config.vpdb.db);

		// bootstrap endpoints
		for (let endPoint of endPoints) {
			logger.info('[app] Registering %s:', endPoint.name);
			server.register(endPoint);
		}
		server.postRegister();

		// setup ACLs
		await initAcls();

		// go!
		server.start();

	} catch (err) {
		console.error(err);
	}
})();
