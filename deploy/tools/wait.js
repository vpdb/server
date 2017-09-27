'use strict';

Promise = require('bluebird');
const http = require('http');
const settings = require('../../src/modules/settings');

function check() {
	return new Promise((resolve, reject) => {
		http.get({
			hostname: settings.current.vpdb.api.hostname,
			port: settings.current.vpdb.api.port,
			path: settings.apiPath('/'),
		}, () => {
			resolve();

		}).on('error', () => {
			reject();
		});
	});
}

let counter = 30;
function poll() {
	return check().then(() => {
		console.log('[wait] Server up!');
		process.exit(0);

	}).catch(() => {
		if (counter-- > 0) {
			console.log('[wait] Waiting for server %s...', settings.apiUri());
			return Promise.delay(1000).then(poll);
		} else {
			process.exit(1);
		}
	});
}
poll();