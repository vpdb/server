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

import { EndPoint } from './common/types/endpoint';
import { UserEndPoint } from './users';
import { config } from './common/settings';
import { server } from './server';
import { init as initAcls } from './common/acl';

// links:
//   - https://github.com/Microsoft/TypeScript-Node-Starter
//   - http://brianflove.com/2016/11/11/typescript-2-express-mongoose-mocha-chai/
//   - https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6
(async () => {
	try {

		const endPoints:EndPoint<any>[] = [ new UserEndPoint() ];

		// bootstrap models
		console.log('Connecting to MongoDB...');
		await mongoose.connect(config.vpdb.db);

		// bootstrap endpoints
		for (let endPoint of endPoints) {
			console.log('Registering end point %s...', endPoint.name);
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
