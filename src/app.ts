import mongoose from 'mongoose';

import { Server } from './server';
import { EndPoint } from './common/types/endpoint';
import { UserEndPoint } from './users';

const config = require('../config/vpdb');

// links:
//   - https://github.com/Microsoft/TypeScript-Node-Starter
//   - http://brianflove.com/2016/11/11/typescript-2-express-mongoose-mocha-chai/
//   - https://gist.github.com/brennanMKE/ee8ea002d305d4539ef6
(async () => {
	try {

		const endPoints:EndPoint<any>[] = [ new UserEndPoint() ];

		// bootstrap models
		console.log('Connecting to MongoDB...');
		await mongoose.connect(config.db);

		// bootstrap endpoints
		const server = new Server();
		for (let endPoint of endPoints) {
			console.log('Registering end point %s...', endPoint.name);
			server.register(endPoint);
		}

		// go!
		server.start();

	} catch (err) {
		console.error(err);
	}
})();
