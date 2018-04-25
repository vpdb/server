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
import { LogUserEndPoint } from './log-user';
import { UserEndPoint } from './users';

// links:
//   - https://github.com/Microsoft/TypeScript-Node-Starter
//   - http://brianflove.com/2016/11/11/typescript-2-express-mongoose-mocha-chai/
//   - https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6
(async () => {
	try {
		logger.info('[app] Starting up...');

		const endPoints:EndPoint[] = [ new AuthenticationEndPoint(), new UserEndPoint(), new LogUserEndPoint() ];

		// bootstrap models
		logger.info('[app] Connecting to MongoDB...');
		await mongoose.connect(config.vpdb.db);

		// bootstrap endpoints
		for (let endPoint of endPoints) {
			if (endPoint.paths.length) {
				logger.info('[app] Registering end-point %s at %s', endPoint.name, endPoint.paths.join(', '));
			} else {
				logger.info('[app] Registering end-point %s', endPoint.name);
			}

			server.register(endPoint);
		}

		// setup ACLs
		await initAcls();

		// go!
		server.start();

	} catch (err) {
		console.error(err);
	}
})();
