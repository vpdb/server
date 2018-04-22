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
