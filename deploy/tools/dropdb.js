'use strict';

Promise = require('bluebird');
const mongoose = require('mongoose');
const redis = require('redis');
mongoose.Promise = Promise;
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const settings = require('../../config/settings.test');

const mongoOpts = {
	keepAlive: true,
	connectTimeoutMS: 5000,
	useNewUrlParser: true
};
let redisClient;
mongoose.connect(settings.vpdb.db, mongoOpts).then(() => {
	console.log('[dropdb] Dropping MongoDB collection...');
	return mongoose.connection.db.dropDatabase();

}).then(() => {
	console.log('[dropdb] Closing MongoDB collection...');
	return mongoose.connection.close();

}).then(() => {
	redisClient = redis.createClient(settings.vpdb.redis.port, settings.vpdb.redis.host, { no_ready_check: true });

	console.log('[dropdb] Flushing Redis...');
	redisClient.select(settings.vpdb.redis.db);
	return redisClient.flushallAsync();

}).then(() => {
	redisClient.end(true);
	console.log('[dropdb] All done!');
	process.exit(0);

}).catch(err => {
	console.log('[dropdb] Error dropping databases: %s', err.message);
	process.exit(1);
});