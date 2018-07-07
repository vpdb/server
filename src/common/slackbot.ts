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

import { RTMClient, WebClient } from '@slack/client';
import { MessageAttachment } from '@slack/client/dist/methods';
import { RTMClientOptions } from '@slack/client/dist/RTMClient';

import { LogEvent } from '../log-event/log.event';
import { LogUser } from '../log-user/log.user';
import { state } from '../state';
import { ContentAuthor } from '../users/content.author';
import { User } from '../users/user';
import { logger } from './logger';
import { config, settings } from './settings';

const red = '#cf0000';
const delay = 5000;

/* istanbul ignore next  */
export class SlackBot {

	private readonly enabled: boolean = false;
	private config: { enabled: boolean; token: string; channels: { eventLog: string; userLog: string; general: string } };
	private web: WebClient;
	private rtm: RTMClient;

	constructor() {
		if (config.vpdb.logging.slack && config.vpdb.logging.slack.enabled) {
			this.enabled = true;
			this.config = config.vpdb.logging.slack;

			this.web = new WebClient(this.config.token);
			this.rtm = new RTMClient(this.config.token, { logLevel: 'info', mrkdwn: true } as RTMClientOptions);
			this.rtm.on('authenticated', rtmStartData => {
				logger.info(`[SlackBot] Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel.`);
			});
			this.rtm.start({});
		}
	}

	public async logEvent(log: LogEvent): Promise<void> {
		if (!this.enabled) {
			return;
		}
		const msg: { msg: string, atts?: MessageAttachment[] } = { msg: '', atts: [] };
		const actor = await state.models.User.findById((log._actor as User)._id || log._actor).exec();
		switch (log.event) {
			case 'create_comment':
				msg.msg = `Commented on *${log.payload.comment.release.name}* of ${log.payload.comment.release.game.title} (${log.payload.comment.release.game.manufacturer} ${log.payload.comment.release.game.year}):`;
				msg.atts = [{
					fallback: log.payload.comment.message,
					text: '> ' + log.payload.comment.message.trim(),
					mrkdwn_in: ['text'],
				} as MessageAttachment];
				break;

			case 'star_game':
				msg.msg = `Starred *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}).`;
				break;

			case 'star_release':
				msg.msg = `Starred *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}).`;
				break;
			case 'star_user':
				break;

			case 'unstar_game':
				msg.msg = `Unstarred *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}).`;
				break;

			case 'unstar_release':
				msg.msg = `Unstarred *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}).`;
				break;

			case 'unstar_user':
				break;

			case 'rate_game':
				if (log.payload.updated) {
					msg.msg = `Updated rating for *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}) to ${log.payload.rating.value}/10.`;
				} else {
					msg.msg = `Rated *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}) with ${log.payload.rating.value}/10.`;
				}
				break;

			case 'rate_release':
				if (log.payload.updated) {
					msg.msg = `Updated rating for *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}) to ${log.payload.rating.value}/10.`;
				} else {
					msg.msg = `Rated *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}) with ${log.payload.rating.value}/10.`;
				}
				break;

			case 'upload_rom':
				break;

			case 'create_game':
				msg.msg = 'Created new game:';
				msg.atts = [{
					fallback: `${log.payload.game.title} (${log.payload.game.manufacturer} ${log.payload.game.year})`,
					title: `${log.payload.game.title} (${log.payload.game.manufacturer} ${log.payload.game.year})`,
					title_link: settings.webUri('/games/' + log.payload.game.id),
					image_url: log.payload.game.backglass.variations.small.url,
				}];
				break;

			case 'update_game':
				const game = await state.models.Game.findById(log._ref.game).exec();
				msg.msg = 'Updated game:';
				msg.atts = [{
					fallback: `${game.title} (${game.manufacturer} ${game.year})`,
					title: `${game.title} (${game.manufacturer} ${game.year})`,
					title_link: settings.webUri('/games/' + game.id),
					text: '```\n' + JSON.stringify(log.payload.new, null, '  ') + '```',
					mrkdwn_in: ['text'],
				} as MessageAttachment];
				break;

			case 'delete_game':
				break;

			case 'create_release': {
				msg.atts = [];
				msg.atts.push({
					fallback: log.payload.release.name,
					author_name: log.payload.release.authors.map((author: ContentAuthor) => author.user.name).join(', '),
					title: log.payload.release.name,
					title_link: settings.webUri('/games/' + log.payload.game.id + '/releases/' + log.payload.release.id),
					text: log.payload.release.description,
					mrkdwn_in: ['text'],
					image_url: log.payload.release.thumb.image.url,
				} as MessageAttachment);
				if (!log.payload.release.moderation.auto_approved) {
					msg.atts.push({
						fallback: 'Approval needed!',
						title: 'Approval needed!',
						title_link: settings.webUri('/admin/uploads'),
						color: red,
					});
				}
				msg.msg = `Created new release for *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}):`;
				break;
			}
			case 'update_release':
				break;
			case 'create_release_version':
				break;
			case 'update_release_version':
				break;
			case 'delete_release':
				break;
			case 'create_backglass':
				break;
			case 'moderate':
				break;
			case 'create_game_request':
				break;
			case 'update_game_request':
				break;
			case 'delete_game_request':
				break;
			default:
				break;
		}
		if (!msg.msg) {
			msg.msg = 'Unknown event `' + log.event + '`:\n```' + JSON.stringify(log.payload, null, '  ') + '```';
		}

		// sleep
		await new Promise(resolve => setTimeout(resolve, delay));

		try {
			await this.web.chat.postMessage({
				channel: this.config.channels.eventLog,
				text: msg.msg,
				as_user: false,
				username: actor.name,
				attachments: msg.atts,
				icon_url: 'https://www.gravatar.com/avatar/' + actor.gravatar_id + '?d=retro',
			});
		} catch (err) {
			logger.error(err, 'Error sending event log to slack.');
		}
	}

	public async logUser(log: LogUser): Promise<void> {
		if (!this.enabled) {
			return;
		}
		const user = await state.models.User.findById((log._user as User)._id || log._user).exec();
		const actor = await state.models.User.findById((log._actor as User)._id || log._actor).exec();

		const self = user.id === actor.id;
		const msg: { msg: string, atts?: MessageAttachment[] } = { msg: '', atts: [] };
		switch (log.event) {
			case 'authenticate':
				if (log.result == 'success') {
					if (log.payload.provider === 'local') {
						msg.msg = `Logged in using ${log.payload.how}.`;
					} else {
						msg.msg = `Logged in through ${log.payload.provider}.`;
					}
				} else {
					msg.msg = 'Failed logging in.';
					msg.atts = [{ color: red, text: log.message }];
				}
				break;
			case 'registration':
				msg.msg = `Registered as <${log.payload.email}>.`;
				break;
			case 'email_confirmed':
				msg.msg = `Confirmed email <${log.payload.email}>.`;
				break;
			case 'registration_email_confirmed':
				msg.msg = `Finished registration with email <${log.payload.email}>.`;
				break;
			case 'change_password':
				msg.msg = 'Changed password.';
				break;
			case 'create_local_account':
				msg.msg = 'Added local credentials.';
				break;
			case 'update_email_request':
				msg.msg = `Requested to change email address from <${log.payload.old}> to <${log.payload.new}>.`;
				break;
			case 'cancel_email_update':
				msg.msg = 'Cancelled request to change email.';
				break;
			case 'update':
				if (self) {
					msg.msg = 'Updated profile.';
				} else {
					msg.msg = `Updated profile of user *${user.name}*.`;
				}
				break;
			default:
				msg.msg = 'New event `' + log.event + '`:\n```' + JSON.stringify(log.payload, null, '  ') + '```';
				break;
		}

		try {
			if (msg.msg) {
				await this.web.chat.postMessage({
					channel: this.config.channels.userLog,
					text: msg.msg,
					as_user: false,
					username: actor.name,
					attachments: msg.atts,
					icon_url: 'https://www.gravatar.com/avatar/' + actor.gravatar_id + '?d=retro',
				});

				//this.rtm.sendMessage(msg, this.config.channels.userLog);
			}

		} catch (err) {
			logger.error(err, 'Error sending log to slack.');
		}
	}
}

export const slackbot = new SlackBot();
