Promise = require('bluebird');

const fs = require('fs');
const logger = require('winston');
const resolve = require('path').resolve;
const mongoose = require('mongoose');
const config = require('../modules/settings').current;

Promise.try(() => {

	return new Promise((resolve, reject) => {

		// bootstrap db connection
		const mongoOpts = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 5000 } }, auto_reconnect: true };
		mongoose.connection.on('open', function() {
			logger.info('Database connected to %s.', config.vpdb.db);
			resolve();
		});
		mongoose.connection.on('error', function (err) {
			logger.error('Database connection failed: %s.', err.message);
			reject(err);
		});
		mongoose.connect(config.vpdb.db, mongoOpts);
	});

}).then(() => {

	// bootstrap models
	const modelsPath = resolve(__dirname, '../models');
	fs.readdirSync(modelsPath).forEach(file => {
		if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
			require(modelsPath + '/' + file);
		}
	});

	// update from Pinside
	const pinside = require('../modules/pinside');
	return pinside.updateTop100({ top300: true });

}).then(result => {

	const total = result.matched + result.missed + result.double;
	console.log('Total: %d', total);
	console.log('Matched: %d (%d%)', result.matched, Math.round(result.matched / total * 100));
	console.log('Missed: %d (%d%)', result.missed, Math.round(result.missed / total * 100));
	console.log('Double: %d (%d%)', result.double, Math.round(result.double / total * 100));
	//console.log(require('util').inspect(result, { colors:true }));

}).catch(err => {
	console.error(err.stack);

}).finally(() => {
	mongoose.disconnect();
});