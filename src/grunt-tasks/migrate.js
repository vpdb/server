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

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const util = require('util');
const request = require('request');
const mongoose = require('mongoose');
const Git = require('nodegit');

const config = require('../modules/settings').current;

mongoose.Promise = Promise;

module.exports = function(grunt) {

	let scriptFolder = path.resolve(__dirname, '../migrations');

	grunt.registerTask('migrate', function() {

		let done = this.async();
		let runNumber = grunt.option('run-number');
		let fromFolder = grunt.option('from');
		let toFolder = grunt.option('to') || '.';

		// only run one script?
		if (runNumber) {
			let scripts = fs.readdirSync(scriptFolder);
			let prefix = _.padStart(runNumber, 2, '0') + '-';
			let script = _.find(scripts, filename => filename.startsWith(prefix));
			if (!script) {
				throw new Error('No script found starting with ' + prefix);
			}
			return Promise.try(bootstrapDatabase).then(() => {
				grunt.log.writeln('Executing migrating script %s...', script);
				let migrate = require(path.resolve(scriptFolder, script));
				return migrate.up(grunt);

			}).nodeify(done);
		}

		if (!fromFolder) {
			throw new Error('Must specify --from option when migrating.');
		}
		fromFolder = path.resolve(fromFolder);
		toFolder = path.resolve(toFolder);

		if (fromFolder === toFolder) {
			grunt.log.writeln('Migration source and destination identical, skipping.');
			return done();
		}

		let fromRepo, toRepo, fromCommit, toCommit, foundFromCommit = false;
		return Promise.try(() => {
			return bootstrapDatabase();

		}).then(() => {
			return Git.Repository.open(fromFolder);

		}).then(repo => {
			fromRepo = repo;
			return Git.Repository.open(toFolder);

		}).then(repo => {
			toRepo = repo;
			return fromRepo.getHeadCommit();

		}).then(commit => {
			fromCommit = commit;
			return toRepo.getCommit(fromCommit.sha()).catch(() => {
				throw new Error('Cannot find commit ' + fromCommit.sha() + ' in repository ' + toFolder + ' - Are you sure the "from" folder is the same repo as the "to" folder?');
			});

		}).then(() => {
			return toRepo.getHeadCommit();

		}).then(commit => {
			toCommit = commit;
			return new Promise((resolve, reject) => {
				let commits = [];
				toCommit.history(Git.Revwalk.SORT.TOPOLOGICAL)
					.on('end', c => resolve(commits))
					.on('error', reject)
					.on('commit', commit => {
						foundFromCommit = foundFromCommit || commit.sha() === fromCommit.sha();
						if (!foundFromCommit) {
							commits.push(commit);
						}
					})
					.start();
			});

		}).then(commits => {

			if (!foundFromCommit) {
				grunt.log.writeln('Initial commit not found, aborting (this can happen on a force push).');
				return;
			}
			let scripts = fs.readdirSync(scriptFolder);
			grunt.log.writeln('Found %s commits between %s and %s.', commits.length, fromCommit.sha().substring(0, 7), toCommit.sha().substring(0, 7));
			return Promise.each(_.reverse(commits), commit => {
				let script = _.find(scripts, filename => commit.sha().startsWith(filename.split('-')[1]));
				if (!script) {
					return;
				}
				grunt.log.writeln('Executing migrating script %s for commit %s...', script, commit.sha());
				let migrate = require(path.resolve(scriptFolder, script));
				return migrate.up(grunt);
			});

		}).nodeify(done);
	});
};

/**
 * Connectes to MongoDB and boostraps all models.
 * @returns {Promise}
 */
function bootstrapDatabase() {
	return Promise.try(() => {
		// bootstrap db connection
		return mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } }, promiseLibrary: require('bluebird') });

	}).then(() => {
		// bootstrap models
		const modelsPath = path.resolve(__dirname, '../models');
		fs.readdirSync(modelsPath).forEach(function(file) {
			if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
				require(modelsPath + '/' + file);
			}
		});
	});
}
