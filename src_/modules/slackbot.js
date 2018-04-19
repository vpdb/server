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

const logger = require('winston');
const settings = require('../../src/common/settings');
const { WebClient, RTMClient } = require('@slack/client');


const config = settings.current;

const red = '#cf0000';
const delay = 5000;

/* istanbul ignore next  */
class SlackBot {

	constructor() {
		if (config.vpdb.logging.slack && config.vpdb.logging.slack.enabled) {
			this.enabled = true;
			this.config = config.vpdb.logging.slack;

			this.web = new WebClient(this.config.token);
			this.rtm = new RTMClient(this.config.token, { logLevel: 'info', mrkdwn: true });
			this.rtm.on('authenticated', rtmStartData => {
				logger.info(`[slack] Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel.`);
			});

			this.rtm.start();
		}
	}

	logEvent(log) {
		if (!this.enabled) {
			return Promise.resolve();
		}
		const User = require('mongoose').model('User');
		let actor;
		return Promise.try(() => {
			return User.findById(log._actor._id || log._actor);

		}).then(u => {
			actor = u;
			switch (log.event) {
				case 'create_comment':
					return [
						`Commented on *${log.payload.comment.release.name}* of ${log.payload.comment.release.game.title} (${log.payload.comment.release.game.manufacturer} ${log.payload.comment.release.game.year}):`,
						[{
							fallback: log.payload.comment.message,
							text: '> ' + log.payload.comment.message.trim(),
							mrkdwn_in: ['text']
						}]
					];

				case 'star_game':
					return [`Starred *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}).`];

				case 'star_release':
					return [`Starred *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}).`];

				case 'star_user':
					break;

				case 'unstar_game':
					return [`Unstarred *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}).`];

				case 'unstar_release':
					return [`Unstarred *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}).`];

				case 'unstar_user':
					break;

				case 'rate_game':
					if (log.payload.updated) {
						return [`Updated rating for *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}) to ${log.payload.rating.value}/10.`];
					} else {
						return [`Rated *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}) with ${log.payload.rating.value}/10.`];
					}

				case 'rate_release':
					if (log.payload.updated) {
						return [`Updated rating for *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}) to ${log.payload.rating.value}/10.`];
					} else {
						return [`Rated *${log.payload.release.name}* of ${log.payload.release.game.title} (${log.payload.release.game.manufacturer} ${log.payload.release.game.year}) with ${log.payload.rating.value}/10.`];
					}

				case 'upload_rom':
					break;

				case 'create_game':
					return [
						'Created new game:',
						[{
							fallback: `${log.payload.game.title} (${log.payload.game.manufacturer} ${log.payload.game.year})`,
							title: `${log.payload.game.title} (${log.payload.game.manufacturer} ${log.payload.game.year})`,
							title_link: settings.webUri('/games/' + log.payload.game.id),
							image_url: log.payload.game.backglass.variations.small.url
						}]
					];

				case 'update_game':
					return require('mongoose').model('Game').findById(log._ref.game).then(game => {
						return [
							'Updated game:',
							[{
								fallback: `${game.title} (${game.manufacturer} ${game.year})`,
								title: `${game.title} (${game.manufacturer} ${game.year})`,
								title_link: settings.webUri('/games/' + game.id),
								text: '```\n' + JSON.stringify(log.payload.new, null, '  ') + '```',
								mrkdwn_in: ['text']
							}]
						];
					});

				case 'delete_game':
					break;

				case 'create_release': {
					let attachments = [];
					attachments.push({
						fallback: log.payload.release.name,
						author_name: log.payload.release.authors.map(author => author.user.name).join(', '),
						title: log.payload.release.name,
						title_link: settings.webUri('/games/' + log.payload.game.id + '/releases/' + log.payload.release.id),
						text: log.payload.release.description,
						mrkdwn_in: ['text'],
						image_url: log.payload.release.thumb.image.url
					});
					if (!log.payload.release.moderation.auto_approved) {
						attachments.push({
							fallback: 'Approval needed!',
							title: 'Approval needed!',
							title_link: settings.webUri('/admin/uploads'),
							color: red
						});
					}
					return [
						`Created new release for *${log.payload.game.title}* (${log.payload.game.manufacturer} ${log.payload.game.year}):`,
						attachments
					];
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
			return ['Unknown event `' + log.event + '`:\n```' + JSON.stringify(log.payload, null, '  ') + '```'];

		}).spread((msg, attachments) => {
			attachments = attachments || [];
			if (msg) {
				return Promise.delay(delay).then(() => {
					this.web.chat.postMessage({
						channel: this.config.channels.eventLog,
						text: msg,
						as_user: false,
						username: actor.name,
						attachments: attachments,
						icon_url: 'https://www.gravatar.com/avatar/' + actor.gravatar_id + '?d=retro'

					});
				});
			}

		}).catch(err => {
			logger.error(err, 'Error sending event log to slack.');
		});
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
			let msg, attachments = [];
			switch (log.event) {
				case 'authenticate':
					if (log.result == 'success') {
						if (log.payload.provider === 'local') {
							msg = `Logged in using ${log.payload.how}.`;
						} else {
							msg = `Logged in through ${log.payload.provider}.`;
						}
					} else {
						msg = 'Failed logging in.';
						attachments = [{ color: red, text: log.message }];
					}
					break;
				case 'registration':
					msg = `Registered as <${log.payload.email}>.`;
					break;
				case 'email_confirmed':
					msg = `Confirmed email <${log.payload.email}>.`;
					break;
				case 'registration_email_confirmed':
					msg = `Finished registration with email <${log.payload.email}>.`;
					break;
				case 'change_password':
					msg = 'Changed password.';
					break;
				case 'create_local_account':
					msg = 'Added local credentials.';
					break;
				case 'update_email_request':
					msg = `Requested to change email address from <${log.payload.old}> to <${log.payload.new}>.`;
					break;
				case 'cancel_email_update':
					msg = 'Cancelled request to change email.';
					break;
				case 'update':
					if (self) {
						msg = 'Updated profile.';
					} else {
						msg = `Updated profile of user *${user.name}*.`;
					}
					break;
				default:
					msg = 'New event `' +  log.event + '`:\n```' + JSON.stringify(log.payload, null,  '  ') + '```';
					break;
			}

			if (msg) {
				this.web.chat.postMessage({
					channel: this.config.channels.userLog, text: msg,
					as_user: false,
					username: actor.name,
					attachments: attachments,
					icon_url: 'https://www.gravatar.com/avatar/' + actor.gravatar_id + '?d=retro'
				});

				//this.rtm.sendMessage(msg, this.config.channels.userLog);
			}

		}).catch(err => {
			logger.error(err, 'Error sending log to slack.');
		});
	}
}

module.exports = new SlackBot();