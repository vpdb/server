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

const path = require('path');
const logger = require('winston');
const Git = require("nodegit");

class Gitinfo {

	constructor() {

		var foo = !!!bar;

		this.info = {
			local: {
				branch: {
					current: {
						name: "unknown",
						SHA: "unknown",
						shortSHA: "unknown",
						currentUser: "unknown",
						lastCommitTime: new Date(),
						lastCommitMessage: "",
						lastCommitAuthor: "unknown"
					}
				}
			}
		};

		const repoRoot = path.resolve(__dirname, '../..');
		Git.Repository.open(repoRoot).then(repo => {
			return repo.getCurrentBranch().then(branch => {
				return repo.getCurrentBranch()
					.then(ref => repo.getBranchCommit(branch))
					.then(commit => {
						this.info.local.branch.current = {
							name: branch,
							SHA: commit.sha(),
							shortSHA: commit.sha().substr(0, 7),
							lastCommitTime: new Date(commit.timeMs()),
							lastCommitMessage: commit.message(),
							lastCommitAuthor: commit.author().name
						}
					});
			});
		}).then(() => {
			logger.info('[git] Successfully read git config from %s.', repoRoot);

		}).catch(err => {
			logger.warn('[git] Unable to retrieve git info from %s (%s)', repoRoot, err.message);
		});
	}
}

module.exports = new Gitinfo();