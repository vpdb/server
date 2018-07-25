/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { resolve } from 'path';
import { logger } from './logger';

class GitInfo {

	private currentLocalBranch: LastCommit;

	constructor() {
		(async () => {
			try {
				const Git = require('nodegit');
				const repoRoot = resolve(__dirname, '../..');

				try {
					const repo = await Git.Repository.open(repoRoot);
					const branch = await repo.getCurrentBranch();
					const commit = await repo.getBranchCommit(branch);
					this.currentLocalBranch = {
						name: branch,
						SHA: commit.sha(),
						shortSHA: commit.sha().substr(0, 7),
						lastCommitTime: new Date(commit.timeMs()),
						lastCommitMessage: commit.message(),
						lastCommitAuthor: commit.author().name,
					};
					logger.info(null, '[git] Successfully read git config from %s.', repoRoot);
				} catch (err) {
					/* istanbul ignore next: we assume node-git is working */
					logger.warn(null, '[git] Unable to retrieve git info from %s (%s)', repoRoot, err.message);
				}
			} catch (err) {
				/* istanbul ignore next: we assume node-git is working */
				logger.warn(null, '[GitInfo] Error loading library.');
			}
		})();
	}

	public hasInfo(): boolean {
		return !!this.currentLocalBranch;
	}

	public getLastCommit(): LastCommit {
		return this.currentLocalBranch;
	}
}

export interface LastCommit {
	name: string;
	SHA: string;
	shortSHA: string;
	lastCommitTime: Date;
	lastCommitMessage: string;
	lastCommitAuthor: string;
}

export const gitInfo = new GitInfo();
