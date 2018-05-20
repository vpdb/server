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

import { uniq } from 'lodash';
import { config } from './settings';
import { Game } from '../games/game';
import { Release } from '../releases/release';
import { ReleaseVersion } from '../releases/release.version';
import { logger } from './logger';
import { server } from '../server';
import { User } from '../users/user';

const Pusher = require('pusher');

class Realtime {

	/**
	 * Pusher API
	 */
	private api: any;
	private readonly isEnabled: boolean;

	constructor() {
		this.isEnabled = config.vpdb.pusher.enabled;
		if (this.isEnabled) {
			this.api = new Pusher(config.vpdb.pusher.options);
		}
	}

	public async addVersion(game:Game, release:Release, version:ReleaseVersion) {

		// don't even bother quering..
		if (!this.isEnabled) {
			return logger.info('[pusher] [addVersion] Disabled, skipping announce.');
		}

		const subscribedUsers = await server.models().User.find({ 'channel_config.subscribed_releases': release.id });

		const users = subscribedUsers.filter(user => this.isUserEnabled(user));
			logger.info('Found %d authorized user(s) subscribed to release %s.', users.length, release.id);

			const userChannels = uniq(users.map(user => this.getChannel(user)));
			userChannels.forEach(chan => {
				logger.info('Announcing update to channel %s', chan);
				this.api.trigger(chan, 'new_release_version', { game_id: game.id, release_id: release.id, version: version.version });
			});
	}

	public star(type:string, entity:{id:string}, user:User) {
		/* istanbul ignore if: Pusher not enabled in tests */
		if (this.isUserEnabled(user)) {
			this.api.trigger(this.getChannel(user), 'star', { id: entity.id, type: type });
		}
	}

	public unstar(type:string, entity:{id:string}, user:User) {
		/* istanbul ignore if: Pusher not enabled in tests */
		if (this.isUserEnabled(user)) {
			this.api.trigger(this.getChannel(user), 'unstar', { id: entity.id, type: type });
		}
	}

	/**
	 * Returns true if the Pusher API is enabled and the user's plan supports it.
	 * @param user User to check
	 * @returns {boolean} True if a message can be sent, false otherwise.
	 */
	public isUserEnabled(user:User) {
		return this.isEnabled && user.planConfig.enableRealtime;
	}

	/* istanbul ignore next: Pusher not enabled in tests */
	private getChannel(user:User) {
		return 'private-user-' + user.id;
	}
}

export const realtime = new Realtime();
