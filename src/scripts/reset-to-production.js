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

'use strict';
Promise = require('bluebird');

const _ = require('lodash');
const fs = require('fs');
const url = require('url');
const spawn = require('child_process').spawn;
const axios = require('axios');
const config = require('../modules/settings').current;
const resolve = require('path').resolve;

const exportPath = resolve(config.vpdb.tmp, 'mongo-reset-export');
// eslint-disable-next-line no-unused-vars
let sha, dbConfig, dbUser, dbPassword, dbName, replicaConfig, replicaUser, replicaPassword, replicaName;

/**
 * Exports production database and imports it into staging.
 *
 * In your current deployment folder, run:
 *
 * > APP_SETTINGS=../settings.js node src/scripts/reset-to-production.js
 *
 * Replace emails (in MongoDB console):
 *
 var bulk = db.users.initializeUnorderedBulkOp();
 var count = 0;
 db.users.find({ email: { $ne: 'freezy@xbmc.org' } }).forEach(function(doc) {
    var newEmail = doc.email.replace(/([^@]+)@(.*)/, '$1_$2@vpdb.io');
    bulk.find({ id: doc.id }).updateOne({ $set: { email: newEmail } });
    count++;
    if (count % 100 === 0) {
        bulk.execute();
        bulk = db.users.initializeUnorderedBulkOp();
    }
 })
 if (count > 0) {
   bulk.execute();
 }

 *
 */
Promise.try(() => {

	if (!config.primary) {
		throw Error('Host must have a primary config in order to reset to production.');
	}

	if (_.isEqual(config.vpdb.api, config.primary.api)) {
		throw Error('Primary cannot be the same host!');
	}

	dbConfig = url.parse(config.vpdb.db);
	dbName = dbConfig.path.substring(1);
	if (dbConfig.auth) {
		[dbUser, dbPassword] = dbConfig.auth.split(':');
	}
	replicaConfig = url.parse(config.primary.replicaDB);
	replicaName = replicaConfig.path.substring(1);
	if (replicaConfig.auth) {
		[replicaUser, replicaPassword] = replicaConfig.auth.split(':');
	}

	// retrieve primary version
	const p = config.primary.api;
	console.log('=== Retrieving build number at %s...', config.primary.api.hostname);
	return axios({ method: 'get', url: `${p.protocol}://${p.hostname}:${p.port}${p.pathname}/` });

}).then(function(response) {

	sha = response.data.app_sha;
	console.log('=== Primary "%s" at %s is up and running build %s.', response.data.app_name, config.primary.api.hostname, sha);

	// TODO checkout given SHA1

	if (fs.existsSync(exportPath)) {
		// deleting previous export location
		console.log('=== Deleting old export folder...');
		return exec('rm', ['-rf', exportPath]);
	}

}).then(() => {

	fs.mkdirSync(exportPath);

	// export with mongodump
	let args = getArgs(replicaConfig, replicaUser, replicaPassword);
	args.push('-d');
	args.push(replicaName);
	args.push('-o');
	args.push(exportPath);

	console.log('=== Exporting data from replica...');
	return exec('mongodump', args);

}).then(() => {

	// drop db that is reimported
	let args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
	args.push(dbName);
	args.push('--eval');
	args.push('db.dropDatabase()');

	console.log('=== Dropping database %s...', dbName);
	return exec('mongo', args).catch(() => {
		console.warn('Initial drop failed but don\'t care.');
	});

}).then(() => {

	// import with mongorestore
	let args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
	args.push('-d');
	args.push(dbName);
	args.push(resolve(exportPath, replicaName));

	console.log('=== Importing data from replica...');
	return exec('mongorestore', args);

}).then(() => {

	// create user if needed
	if (dbConfig.auth) {
		let args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
		args.push(dbName);
		args.push('--eval');
		args.push(`db.grantRolesToUser("${dbUser}", [ { role: "readWrite", db: "${dbName}" } ] )`);
		return exec('mongo', args);
	}

}).then(() => {
	console.log('=== All done!');

}).catch(err => {
	console.error('ERROR: ', err);
});

function getArgs(dbConfig, user, password, authDatabase) {
	let args = ['--host', dbConfig.hostname];
	if (dbConfig.port) {
		args.push('--port');
		args.push(dbConfig.port);
	}
	if (user) {
		args.push('-u');
		args.push(user);
	}
	if (password) {
		args.push('-p');
		args.push(password);
	}
	if (authDatabase) {
		args.push('--authenticationDatabase');
		args.push(authDatabase);
	}
	return args;
}

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
			console.info(`    - ${data.toString().replace(/\s+$/, '').replace(/\n/g, '\n    -')}`);
		});

		c.stderr.on('data', data => {
			console.error(`    ~ ${data.toString().replace(/\s+$/, '').replace(/\n/g, '\n    ~')}`);
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