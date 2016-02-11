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

	grunt.registerTask('migrate', function() {

		let done = this.async();
		let fromFolder = grunt.option('from');
		let toFolder = grunt.option('to') || '.';
		let fromBranch = grunt.option('from-branch') || 'master';
		let toBranch = grunt.option('to-branch') || 'master';

		if (!fromFolder) {
			throw new Error('Must specify --from option when migrating.');
		}
		fromFolder = path.resolve(fromFolder);
		toFolder = path.resolve(toFolder);

		if (fromFolder === toFolder) {
			grunt.log.writeln('Migration source and destination identical, skipping.');
			return done();
		}

		let fromRepo, toRepo, fromCommit;
		return Promise.try(() => {
			// bootstrap db connection
			return mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } } });

		}).then(() => {
			// bootstrap models
			const modelsPath = path.resolve(__dirname, '../models');
			fs.readdirSync(modelsPath).forEach(function(file) {
				if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
					require(modelsPath + '/' + file);
				}
			});

			return Git.Repository.open(fromFolder);

		}).then(repo => {
			fromRepo = repo;
			return Git.Repository.open(toFolder);

		}).then(repo => {
			toRepo = repo;
			return fromRepo.getBranchCommit(fromBranch);

		}).then(commit => {
			fromCommit = commit;
			return toRepo.getCommit(fromCommit.sha()).catch(() => {
				throw new Error('Cannot find commit ' + fromCommit.sha() + ' in repository ' + toFolder + ' - Are you sure the "from" folder is the same repo as the "to" folder?');
			});

		}).then(() => {
			return toRepo.getBranchCommit(toBranch);

		}).then(toCommit => {

			return new Promise((resolve, reject) => {
				let commits = [];
				let finished = false;
				toCommit.history(Git.Revwalk.SORT.TOPOLOGICAL)
					.on('end', c => resolve(commits))
					.on('error', reject)
					.on('commit', commit => {
						finished = finished || commit.sha() === fromCommit.sha();
						if (!finished) {
							commits.push(commit);
						}
					})
					.start();
			});

		}).then(commits => {
			let scriptFolder = path.resolve(__dirname, '../migrations');
			let scripts = fs.readdirSync(scriptFolder);

			grunt.log.writeln('Found %s commits between folders.', commits.length);
			return Promise.each(_.reverse(commits), commit => {
				let script = _.find(scripts, filename => commit.sha().startsWith(filename.split('-')[1]));
				if (!script) {
					return;
				}
				grunt.log.writeln('Executing migrating script %s for commit %s...', script, commit.sha());
				let migrate = require(path.resolve(scriptFolder, script));
				return migrate.up();
			});

		}).nodeify(done);
	});

};
