'use strict';

Promise = require('bluebird');
const http = require('http');
const config = require('../../src/config/settings-test');

function check() {
	return new Promise((resolve, reject) => {
		http.get({
			hostname: config.vpdb.api.hostname,
			port: config.vpdb.api.port,
			path: (config.vpdb.api.prefix || '') + config.vpdb.api.pathname,
		}, () => {
			resolve();

		}).on('error', () => {
			reject();
		});
	});
}

let counter = 120;
function poll() {
	return check().then(() => {
		console.log('[wait] Server up!');
		process.exit(0);

	}).catch(() => {
		if (counter-- > 0) {
			console.log('[wait] Waiting for server at %s:%s', config.vpdb.api.hostname, config.vpdb.api.port);
			return Promise.delay(1000).then(poll);
		} else {
			process.exit(1);
		}
	});
}
poll();