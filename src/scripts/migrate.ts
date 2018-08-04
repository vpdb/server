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

/* tslint:disable:no-console */
import { readdirSync } from 'fs';
import { padStart, reverse } from 'lodash';
import mongoose from 'mongoose';
import Git, { Commit } from 'nodegit';
import { default as path, resolve as resolvePath } from 'path';
import { argv } from 'yargs';
import { endPoints } from '../app/common/api.endpoints';
import { config } from '../app/common/settings';

const scriptFolder = resolvePath(__dirname, 'migrations');
const scripts = readdirSync(scriptFolder);

(async () => {

	try {
		if (argv['run-number']) {
			await runNumber(argv['run-number']);
		} else {
			await runMigrations(argv.from, argv.to);
		}
		console.info('Migration done.');
		process.exit(0);

	} catch (err) {
		console.error('Migration error.');
		console.error(err.stack);
		process.exit(1);

	} finally {
		await closeDatabase();
	}
})();

async function runNumber(scriptNumber: string) {
	const prefix = padStart(scriptNumber, 2, '0') + '-';
	const script = scripts.find(filename => filename.startsWith(prefix));
	if (!script) {
		throw new Error('No script found starting with ' + prefix);
	}
	await bootstrapDatabase();
	console.log('Executing migrating script %s...', script);
	const migrate = require(path.resolve(scriptFolder, script));
	await migrate.up();
}

async function runMigrations(fromFolder: string, toFolder: string) {
	toFolder = argv.to || '.';
	if (!fromFolder) {
		throw new Error('Must specify --from option when migrating.');
	}
	fromFolder = path.resolve(fromFolder);
	toFolder = path.resolve(toFolder);

	if (fromFolder === toFolder) {
		console.log('Migration source and destination identical, skipping.');
		return;
	}
	await bootstrapDatabase();
	const fromRepo = await Git.Repository.open(fromFolder);
	const toRepo = await Git.Repository.open(toFolder);
	const fromCommit = await fromRepo.getHeadCommit();
	try {
		await toRepo.getCommit(fromCommit.sha());
	} catch (err) {
		console.warn('Cannot find commit %s in repository %s. Assuming force-push, aborting migrations.', fromCommit.sha(), toFolder);
		return;
	}
	let foundFromCommit = false;
	const toCommit = await toRepo.getHeadCommit();
	const commits = await new Promise<Commit[]>((resolve, reject) => {
		const commitsSince: Commit[] = [];
		const emitter = toCommit.history()
			.on('end', () => resolve(commitsSince))
			.on('error', reject)
			.on('commit', (commit: Commit) => {
				foundFromCommit = foundFromCommit || commit.sha() === fromCommit.sha();
				if (!foundFromCommit) {
					commitsSince.push(commit);
				}
			});
		(emitter as any).start();
	});
	if (!foundFromCommit) {
		console.log('Initial commit not found, aborting (this can happen on a force push).');
		return;
	}
	console.log('Found %s commits between %s and %s.', commits.length, fromCommit.sha().substring(0, 7), toCommit.sha().substring(0, 7));
	for (const commit of reverse(commits)) {
		const script = scripts.find(filename => commit.sha().startsWith(filename.split('-')[1]));
		if (!script) {
			return;
		}
		console.log('Executing migrating script %s for commit %s...', script, commit.sha());
		const migrate = require(path.resolve(scriptFolder, script));
		await migrate.up();
	}
}

async function bootstrapDatabase() {
	await mongoose.connect(config.vpdb.db, { useNewUrlParser: true });
	for (const endPoint of endPoints) {
		endPoint.registerModel();
	}
}

async function closeDatabase() {
	await mongoose.connection.close();
}
