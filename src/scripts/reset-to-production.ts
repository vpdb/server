/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

/* tslint:disable:jsdoc-format */
import axios from 'axios';
import { isEqual } from 'lodash';
import { resolve as pathResolve } from 'path';

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { parse, UrlWithStringQuery } from 'url';
import { apiCache } from '../app/common/api.cache';
import { config } from '../app/common/settings';

(async () => {
	await resetToProduction();
})();

/**
 * Exports production database and imports it into staging.
 *
 * In your current deployment folder, run:
 *
 * > APP_SETTINGS=../settings.js node -r ts-node/register build/scripts/reset-to-production.js
 *
 * Replace emails (in MongoDB console):
 *
 *  mongo 127.0.100.100:27010/vpdb
 *
 db.auth('vpdb', '***')
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
async function resetToProduction() {

	try {
		const exportPath = pathResolve(config.vpdb.tmp, 'mongo-reset-export');
		if (!config.primary) {
			throw new Error('Host must have a primary config in order to reset to production.');
		}

		if (isEqual(config.vpdb.api, config.primary.api)) {
			throw new Error('Primary cannot be the same host!');
		}

		const dbConfig = parse(config.vpdb.db);
		const dbName = dbConfig.path.substring(1);
		let dbUser: string;
		let dbPassword: string;
		if (dbConfig.auth) {
			[dbUser, dbPassword] = dbConfig.auth.split(':');
		}
		const replicaConfig = parse(config.primary.replicaDB);
		const replicaName = replicaConfig.path.substring(1);
		let replicaUser: string;
		let replicaPassword: string;
		if (replicaConfig.auth) {
			[replicaUser, replicaPassword] = replicaConfig.auth.split(':');
		}

		// retrieve primary version
		const p = config.primary.api;
		console.log('=== Retrieving build number at %s...', config.primary.api.hostname);
		const response = await axios({ method: 'get', url: `${p.protocol}://${p.hostname}:${p.port}${p.pathname}/v1` });

		const sha = response.data.app_sha;
		console.log('=== Primary "%s" at %s is up and running build %s.', response.data.app_name, config.primary.api.hostname, sha);

		// TODO checkout given SHA1

		if (existsSync(exportPath)) {
			// deleting previous export location
			console.log('=== Deleting old export folder...');
			await exec('rm', ['-rf', exportPath]);
		}

		mkdirSync(exportPath);

		// export with mongodump
		let args = getArgs(replicaConfig, replicaUser, replicaPassword);
		args.push('-d');
		args.push(replicaName);
		args.push('-o');
		args.push(exportPath);

		console.log('=== Exporting data from replica...');
		await exec('mongodump', args);

		// drop db that is reimported
		args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
		args.push(dbName);
		args.push('--eval');
		args.push('db.dropDatabase()');

		console.log('=== Dropping database %s...', dbName);
		try {
			await exec('mongo', args);
		} catch (err) {
			console.warn('Initial drop failed but don\'t care.');
		}

		// import with mongorestore
		args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
		args.push('-d');
		args.push(dbName);
		args.push(pathResolve(exportPath, replicaName));

		console.log('=== Importing data from replica...');
		await exec('mongorestore', args);

		// create user if needed
		if (dbConfig.auth) {
			args = getArgs(dbConfig, config.primary.auth.user, config.primary.auth.password, 'admin');
			args.push(dbName);
			args.push('--eval');
			args.push(`db.grantRolesToUser("${dbUser}", [ { role: "readWrite", db: "${dbName}" } ] )`);
			await exec('mongo', args);
		}

		// clear cache
		await apiCache.invalidateAll();

		console.log('=== All done!');

	} catch (err) {
		console.error('ERROR: ', err);
	}
}

function getArgs(dbConfig: UrlWithStringQuery, user: string, password: string, authDatabase?: string) {
	const args = ['--host', dbConfig.hostname];
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
async function exec(executable: string, args: string[]) {
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
