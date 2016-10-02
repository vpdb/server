/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

"use strict";
Promise = require('bluebird'); // jshint ignore:line

const _ = require('lodash');
const url = require('url');
const fs = require('fs');
const spawn = require('child_process').spawn;
const axios = require('axios');
const config = require('../modules/settings').current;

let sha, cmd;
Promise.try(() => {

	if (!config.primary) {
		throw Error('Host must have a primary config in order to reset to production.');
	}

	if (!process.getuid || process.getuid() !== 0) {
		throw Error('Must be run with root privileges, otherwise I cannot stop the services.');
	}

	if (_.isEqual(config.vpdb.api, config.primary.api)) {
		throw Error('Primary cannot be the same host!');
	}

	if (!fs.existsSync(config.primary.mongoReadOnly.dataPath)) {
		throw Error('Data folder "' + config.primary.mongoReadOnly.dataPath + '" for replicated read-only instance does not exist.');
	}
	if (!fs.existsSync(config.primary.mongoReadWrite.dataPath)) {
		throw Error('Data folder "' + config.primary.mongoReadWrite.dataPath + '" for read-write instance does not exist.');
	}

	console.log('Retrieving build number at %s...', config.primary.api.hostname);

	// retrieve primary version
	const p = config.primary.api;
	return axios({ method: 'get', url: `${p.protocol}://${p.hostname}:${p.port}${p.pathname}/` });

}).then(function(response) {

	sha = response.data.app_sha;
	console.log('Primary "%s" at %s is up and running build %s.', response.data.app_name, config.primary.api.hostname, sha);

	// TODO checkout given SHA1

	console.log('Stopping MongoDB instances...');
	return exec('systemctl', ['stop', config.primary.mongoReadWrite.service]);

}).then(() => {
	return exec('systemctl', ['stop', config.primary.mongoReadOnly.service]);

}).then(() => {
	console.log('Deleting old data...');
	return exec('rm', ['-rf', config.primary.mongoReadWrite.dataPath]);

}).then(() => {
	console.log('Copying replication data...');
	return exec('cp', ['-a', config.primary.mongoReadOnly.dataPath, config.primary.mongoReadWrite.dataPath]);

}).then(() => {
	console.log('Starting MongoDB instances...');
	return exec('systemctl', ['start', config.primary.mongoReadOnly.service]);

}).then(() => {
	return exec('systemctl', ['start', config.primary.mongoReadWrite.service]);

}).then(() => {

	const dbConfig = url.parse(config.vpdb.db);
	const dbName = dbConfig.path.substring(1);
	if (config.primary.mongoReadOnly.dbName !== dbName) {
		return new Promise(resolve => {
			console.log('Waiting for instances to start up...');
			setTimeout(resolve, 2000);
		}).then(() => {
			console.log('Renaming database from "%s" to "%s"...', config.primary.mongoReadOnly.dbName, dbName);
			let args = [config.primary.mongoReadOnly.dbName, '--host', dbConfig.hostname];
			if (dbConfig.port) {
				args.push('--port');
				args.push(dbConfig.port);
			}
			if (dbConfig.auth) {
				const a = dbConfig.auth.split(':');
				args.push('-u');
				args.push(a[0]);
				args.push('-p');
				args.push(a[1]);
			}
			args.push('--eval');
			args.push('db.copyDatabase("' + config.primary.mongoReadOnly.dbName + '", "' + dbName + '");db.dropDatabase();');
			return exec('mongo', args);
		});
	}

}).then(() => {
	console.log('All done!');

}).catch(err => {
	console.error('ERROR: ', err);
});

/**
 * Executes a command.
 * @param {string} executable
 * @param {string[]} args
 * @returns {Promise}
 */
function exec(executable, args) {
	console.log('--> %s %s', executable, args.join(' '));
	return new Promise((resolve, reject) => {
		const c = spawn(executable, args);

		c.stdout.on('data', data => {
			console.info(`--- ${data}`);
		});

		c.stderr.on('data', data => {
			console.error(`~~~ ${data}`);
		});

		c.on('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject();
			}
		});
	});
}
