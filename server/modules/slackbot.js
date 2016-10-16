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

const logger = require('winston');
const config = require('./settings').current;
const RtmClient = require('@slack/client').RtmClient;

const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;

/* istanbul ignore next  */
class SlackBot {

	constructor() {
		if (config.vpdb.logging.slack && config.vpdb.logging.slack.enabled) {
			this.enabled = true;
			this.config = config.vpdb.logging.slack;

			this.rtm = new RtmClient(this.config.token, { logLevel: 'info', mrkdwn: true });
			this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, rtmStartData => {
				logger.info(`[slack] Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel.`);
			});
			// you need to wait for the client to fully connect before you can send messages
			this.rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, () => {
				//this.rtm.sendMessage('Hi guys, I\'m back again!', this.config.channels.general);
			});
			this.rtm.start();
		}
	}

	logEvent(log) {
	}

	logUser(log) {
		if (!this.enabled) {
			return Promise.resolve();
		}
		const User = require('mongoose').model('User');
		let user, actor;
		return Promise.try(() => {
			return User.findById(log._user._id || log._user);
		}).then(u => {
			user = u;
			return User.findById(log._actor._id || log._actor);

		}).then(u => {
			actor = u;
			let self = user.id === actor.id;
			let msg;
			switch (log.event) {
				case 'authenticate':
					if (log.result == 'success') {
						if (log.payload.provider === 'local') {
							msg = `User *${user.name}* logged in using ${log.payload.how}.`;
						} else {
							msg = `User *${user.name}* logged in through ${log.payload.provider}.`;
						}
					} else {
						msg = `User *${user.name}* failed logging in:\n> ${log.message}`;
					}
					break;
				case 'registration':
					msg = `User *${log.payload.username}* successfully registered as <${log.payload.email}>.`;
					break;
				case 'email_confirmed':
					msg = `User *${user.name}* successfully confirmed email <${log.payload.email}>.`;
					break;
				case 'registration_email_confirmed':
					msg = `User *${user.name}* successfully finished registration with email <${log.payload.email}>.`;
					break;
				case 'change_password':
					msg = `User *${user.name}* successfully changed password.`;
					break;
				case 'create_local_account':
					msg = `User *${user.name}* successfully created local credentials.`;
					break;
				case 'update_email_request':
					msg = `User *${user.name}* requested to change email address from <${log.payload.old}> to <${log.payload.new}>.`;
					break;
				case 'cancel_email_update':
					msg = `User *${user.name}* cancelled request to change email.`;
					break;
				case 'update':
					if (self) {
						msg = `User *${user.name}* updated profile.`;
					} else {
						msg = `User *${actor.name}* updated profile of user *${user.name}*.`;
					}
					break;
				default:
					msg = 'Unknown event `' +  log.event + '`:\n```' + JSON.stringify(log.payload, null,  '  ') + '```';
					break;
			}

			if (msg) {
				this.rtm.sendMessage(msg, this.config.channels.userLog);
			}

		}).catch(err => {
			logger.error(err, 'Error sending log to slack.');
		});
	}
}

module.exports = new SlackBot();