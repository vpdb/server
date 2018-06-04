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

import { readFile } from 'fs';
import { resolve } from 'path';
import { isEmpty, upperFirst, uniqWith, flatten } from 'lodash';
import handlebars from 'handlebars';
import nodemailer, { SentMessageInfo } from 'nodemailer';
import Mail, { Address } from 'nodemailer/lib/mailer';

import { state } from '../state';
import { logger } from './logger';
import { config, settings } from './settings';
import { User } from '../users/user';
import { Release } from '../releases/release';
import { ReleaseVersion } from '../releases/release.version';
import { ReleaseVersionFile } from '../releases/release.version.file';
import { Backglass } from '../backglasses/backglass';
import { Game } from '../games/game';
import { ContentAuthor } from '../users/content.author';
import { promisify } from "util";

const readFileAsync = promisify(readFile);
const templatesDir = resolve(__dirname, './email-templates');

class Mailer {

	public async registrationConfirmation(user: User): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'Please confirm your email', 'registration-confirmation', {
			user: user,
			site: settings.webUri(),
			confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
			recipient: user.email
		});
	}

	public async emailUpdateConfirmation(user: User): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'Please confirm your email', 'email-update-confirmation', {
			user: user,
			site: settings.webUri(),
			confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
			recipient: user.email
		});
	}

	public async welcomeLocal(user: User): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'Welcome to the VPDB!', 'welcome-local', { user: user, });
	}

	public async welcomeOAuth(user: User): Promise<SentMessageInfo> {
		const strategyNames: { [key: string]: string } = {
			github: 'GitHub',
			google: 'Google',
			gameex: 'GameEx'
		};
		return this.sendEmail(user, 'Welcome to the VPDB!', 'welcome-oauth', {
			user: user,
			profileUrl: settings.webUri('/profile/settings'),
			strategy: strategyNames[user.provider] || upperFirst(user.provider)
		});
	}

	public async releaseAutoApproved(user: User, release: Release): Promise<SentMessageInfo[]> {
		const game = release._game as Game;
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id }
		}).exec();
		const results: SentMessageInfo[] = [];
		for (let moderator of moderators) {
			const result = await this.sendEmail(moderator, 'A new release has been auto-approved for ' + game.title, 'moderator-release-auto-approved', {
				user: user,
				moderator: moderator,
				release: release,
				game: release._game,
				url: settings.webUri('/games/' + game.id + '/releases/' + release.id)
			}, 'moderator_notify_release_auto_approved');
			result.push(result);
		}
		return results;
	}

	public async releaseSubmitted(user: User, release: Release): Promise<SentMessageInfo[]> {
		const game = release._game as Game;
		const results: SentMessageInfo[] = [];
		// send to submitter
		let result = await this.sendEmail(user, 'Your release for ' + game.title + ' has been submitted', 'release-submitted', {
			user: user,
			previewUrl: settings.webUri('/games/' + game.id + '/releases/' + release.id)

		}, 'notify_release_moderation_status');
		results.push(result);
		// send to moderators
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id }
		}).exec();

		for (let moderator of moderators) {
			const game = release._game as Game;
			result = await this.sendEmail(moderator, 'A new release has been submitted for ' + game.title, 'moderator-release-submitted', {
				user: user,
				moderator: moderator,
				release: release,
				game: release._game,
				previewUrl: settings.webUri('/games/' + game.id + '/releases/' + release.id)
			}, 'moderator_notify_release_submitted');
			results.push(result);
		}
		return results;
	}

	public async releaseApproved(user: User, release: Release, message: string): Promise<SentMessageInfo> {
		const game = release._game as Game;
		return this.sendEmail(user, 'Your release for ' + game.title + ' has been approved!', 'release-approved', {
			user: user,
			release: release,
			game: release._game,
			message: this.wrapMessage(message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id)
		}, 'notify_release_moderation_status');
	}

	public async releaseRefused(user: User, release: Release, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'There was a problem with the release you\'ve uploaded to VPDB', 'release-refused', {
			user: user,
			release: release,
			game: release._game,
			message: this.wrapMessage(message),
		}, 'notify_release_moderation_status');
	}

	public async releaseAdded(uploader: User, author: User, release: Release): Promise<SentMessageInfo> {
		const game = release._game as Game;
		const authorType = this.isUploaderAuthor(uploader, release.authors) ? 'co-author' : 'author';
		return this.sendEmail(author, 'A new release for ' + game.title + ' has been uploaded', 'release-author-new-release', {
			user: author,
			uploader: uploader,
			release: release,
			game: release._game,
			authorType: authorType,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id)
		});
	}

	public async releaseVersionAdded(uploader: User, author: User, release: Release, version: ReleaseVersion): Promise<SentMessageInfo> {
		const game = release._game as Game;
		return this.sendEmail(author, 'A new version for "' + release.name + '" of ' + game.title + ' has been uploaded', 'release-author-new-version', {
			user: author,
			uploader: uploader,
			release: release,
			version: version,
			changes: this.wrapMessage(version.changes),
			game: release._game,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id)
		});
	}

	public async releaseFileAdded(uploader: User, author: User, release: Release, version: ReleaseVersion, versionFile: ReleaseVersionFile): Promise<SentMessageInfo> {
		const game = release._game as Game;
		const file = await state.models.File.findById(versionFile._file).exec();
		return this.sendEmail(author, 'A new file for v' + version.version + ' of "' + release.name + '" of ' + game.title + ' has been uploaded', 'release-author-new-file', {
			user: author,
			uploader: uploader,
			release: release,
			version: version,
			file: file,
			changes: this.wrapMessage(version.changes),
			game: release._game,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id)
		});
	}

	public async backglassSubmitted(user: User, backglass: Backglass): Promise<SentMessageInfo[]> {
		const game = backglass._game as Game;
		const results: SentMessageInfo[] = [];
		let result = await this.sendEmail(user, 'Your backglass for ' + game.title + ' has been submitted', 'backglass-submitted', {
			user: user,
			backglass: backglass
		}, 'notify_backglass_moderation_status');
		results.push(result);
		// send to moderators
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id }
		}).exec();
		for (let moderator of moderators) {
			result = await this.sendEmail(moderator, 'A new backglass has been submitted for ' + game.title, 'moderator-backglass-submitted', {
				user: user,
				moderator: moderator,
				game: backglass._game,
				uploadsUrl: settings.webUri('/admin/uploads')
			}, 'moderator_notify_backglass_submitted');
			results.push(result);
		}
		return results;
	}

	public async backglassAutoApproved(user: User, backglass: Backglass): Promise<SentMessageInfo[]> {
		const results: SentMessageInfo[] = [];
		const game = backglass._game as Game;
		const moderators = await state.models.User.find({ roles: { $in: ['moderator', 'root'] }, id: { $ne: user.id } });
		let result: SentMessageInfo;
		for (let moderator of moderators) {
			result = await this.sendEmail(moderator, 'A new backglass has been auto-approved for ' + game.title, 'moderator-backglass-auto-approved', {
				user: user,
				moderator: moderator,
				game: backglass._game,
				url: settings.webUri('/games/' + game.id)
			}, 'moderator_notify_backglass_auto_approved');
			results.push(result);
		}
		return results;
	}

	public async backglassApproved(user: User, backglass: Backglass, message: string): Promise<SentMessageInfo> {
		const game = backglass._game as Game;
		return this.sendEmail(user, 'Your backglass for ' + game.title + ' has been approved!', 'backglass-approved', {
			user: user,
			message: this.wrapMessage(message),
			game: backglass._game,
			gameUrl: settings.webUri('/games/' + game.id)
		}, 'notify_backglass_moderation_status');
	}

	public async backglassRefused(user: User, backglass: Backglass, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'There was a problem with the backglass you\'ve uploaded to VPDB', 'backglass-refused', {
			user: user,
			game: backglass._game,
			message: this.wrapMessage(message),
		}, 'notify_backglass_moderation_status');
	}

	public async gameRequestProcessed(user: User, game: Game): Promise<SentMessageInfo> {
		return this.sendEmail(user, '"' + game.title + '" has been added to VPDB!', 'game-request-processed', {
			user: user,
			game: game,
			url: settings.webUri('/games/' + game.id)
		}, 'notify_game_requests');
	}

	public async gameRequestDenied(user: User, gameTitle: string, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'About "' + gameTitle + '" you wanted to be added to VPDB...', 'game-request-denied', {
			user: user,
			gameTitle: gameTitle,
			message: this.wrapMessage(message)
		}, 'notify_game_requests');
	}

	public async releaseCommented(user: User, commentor: User, game: Game, release: Release, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(user, 'New reply to your "' + release.name + '" of ' + game.title, 'release-commented', {
			user: user,
			release: release,
			game: game,
			commentor: commentor,
			message: this.wrapMessage(message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
			profileUrl: settings.webUri('/profile/notifications'),
		}, 'notify_created_release_comments');
	}

	public async releaseValidated(user: User, moderator: User, game: Game, release: Release, file: ReleaseVersionFile): Promise<SentMessageInfo> {
		let data = {
			user: user,
			moderator: moderator,
			file: file.file,
			game: game,
			release: release,
			message: this.wrapMessage(file.validation.message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id + '?show-moderation'),
		};
		switch (file.validation.status) {
			case 'verified':
				return this.sendEmail(user, 'Congrats, "' + file.file.name + '" has been validated!', 'validation-release-verified', data, 'notify_release_validation_status');
			case 'playable':
				return this.sendEmail(user, 'Your file "' + file.file.name + '" has been validated.', 'validation-release-playable', data, 'notify_release_validation_status');
			case 'broken':
				return this.sendEmail(user, 'There is an issue with "' + file.file.name + '".', 'validation-release-broken', data, 'notify_release_validation_status');
		}
	}

	public async releaseModerationCommented(user: User, release: Release, message: string): Promise<SentMessageInfo[]> {
		const results: SentMessageInfo[] = [];
		const moderators = await state.models.User.find({ roles: { $in: ['moderator', 'root'] } }).exec();
		const comments = await state.models.Comment.find({ '_ref.release_moderation': release._id }).populate('_from').exec();
		const participants = comments.map(c => c._from as User);

		let all: User[] = uniqWith([...moderators, ...participants, release._created_by as User], (u1: User, u2: User) => u1.id === u2.id);
		const isApproved = release.moderation && release.moderation.is_approved;
		for (let dest of all.filter(u => u.id !== user.id)) {
			const isDestMod = moderators.includes(dest);
			const isSenderMod = user.hasRole(['moderator', 'root']);
			const isDestParticipant = participants.includes(dest);
			const game = release._game as Game;

			const subject = isDestMod ?
				'New comment on "' + release.name + '" of ' + game.title :
				'Comment about your submitted "' + release.name + '" of ' + game.title;

			let result = await this.sendEmail(dest, subject, 'release-moderation-commented', {
				user: dest,
				who: isSenderMod ? 'Moderator' : 'Uploader',
				what: isSenderMod ? (isDestMod ? (release._created_by as User).name + '\'s' : 'your') : 'his',
				release: release,
				game: game,
				commentor: user,
				message: this.wrapMessage(message),
				url: settings.webUri('/games/' + game.id + '/releases/' + release.id + (isApproved ? '?show-moderation' : ''))
			}, isDestParticipant || !isDestMod ? null : 'moderator_notify_release_commented');
			results.push(result);
		}
		return results;
	}

	public async userMergedKept(userKept: User, userMerged: User, message: string): Promise<SentMessageInfo> {
		const subject = 'Another VPDB account has been merged into yours';
		return this.sendEmail(userKept, subject, 'user-merged-kept', {
			user: userKept,
			userDeleted: userMerged,
			message: message,
		});
	}

	public async userMergedDeleted(userKept: User, userMerged: User, message: string): Promise<SentMessageInfo> {
		const subject = 'Your VPDB account has been merged into another one';
		return this.sendEmail(userKept, subject, 'user-merged-deleted', {
			user: userMerged,
			userKept: userKept,
			message: message,
		});
	}

	/**
	 * Sends an email.
	 *
	 * @param {User} user Recipient
	 * @param {string} subject Subject of the email
	 * @param {string} template Name of the Handlebars template, without path or extension
	 * @param {object} templateData Data passed to the Handlebars renderer
	 * @param {string} [enabledFlag] If set, user profile must have this preference set to true
	 * @return Promise<SentMessageInfo>
	 */
	private async sendEmail(user: User, subject: string, template: string, templateData: object, enabledFlag: string = null): Promise<SentMessageInfo> {

		const what = template.replace(/-/g, ' ');
		if (!this.emailEnabled(user, enabledFlag)) {
			logger.info('[mailer.sendEmail] NOT sending %s email to <%s>.', what, user.email);
			return;
		}

		// generate content
		const tpl = await this.getTemplate(template);
		const text = this.wrap(tpl(templateData), 60);

		// setup email
		const email: Mail.Options = {
			from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
			to: { name: user.name, address: user.email },
			subject: subject,
			text: text
		};

		// create reusable transporter object using the default SMTP transport
		const transport = nodemailer.createTransport(config.vpdb.email.nodemailer);
		logger.info('[mailer.sendEmail] Sending %s email to <%s>...', what, (email.to as Address).address);
		const status = await transport.sendMail(email);

		if (status.messageId) {
			logger.info('[mailer.sendEmail] Successfully sent %s mail to <%s> with message ID "%s" (%s).', what, (email.to as Address).address, status.messageId, status.response);
		} else {
			logger.info('[mailer.sendEmail] Failed sending %s mail to <%s>: %s.', what, (email.to as Address).address, status.response);
		}
		return status;
	}

	/**
	 * Returns a Handlebar renderer for a given template name.
	 * @param {string} template Template file without path or extension
	 * @returns {HandlebarsTemplateDelegate} Handlebar renderer
	 */
	private async getTemplate(template: string): Promise<HandlebarsTemplateDelegate> {
		const tpl = await readFileAsync(resolve(templatesDir, template + '.handlebars'));
		return handlebars.compile(tpl.toString());
	}

	/**
	 * Checks if an email should be sent
	 * @param {User} user User object of the recipient
	 * @param {string} [pref] If set, user.preferences[param] must be true
	 * @returns {boolean} True if email should be sent, false otherwise
	 */
	private emailEnabled(user: User, pref: string) {
		if (isEmpty(config.vpdb.email.nodemailer)) {
			return false;
		}
		if (!pref) {
			return true;
		}
		if (!user.preferences) {
			return true;
		}
		return !!user.preferences[pref];
	}

	/**
	 * Wraps a message into a quoted string with line breaks.
	 *
	 * @param {string} message One liner message
	 * @returns {string} Word wrapped and quoted message
	 */
	private wrapMessage(message: string) {
		return message ? this.wrap(message, 58, '> ') : message;
	}

	/**
	 * Wraps a text into multiple lines
	 *
	 * @param {string} text Text to wrap
	 * @param {number} width Line width in chars
	 * @param {string} [indent=''] String to prefix before each line
	 * @returns {string}
	 */
	private wrap(text: string, width: number, indent: string = '') {
		const newline = '\n' + indent;
		const reTest = new RegExp('.{1,' + width + '}(\\s+|$)', 'g');
		const reMatch = new RegExp('.{1,' + width + '}(\\s+|$)|\\S+?(\\s+|$)', 'g');
		const lines = flatten(text.split(/\r?\n/).map(line => {
			if (reTest.test(line)) {
				let match = line.match(reMatch);
				return match[0].trim() ? match : line;
			}
			return line;
		}));
		return indent + lines.join(newline);
	}

	/* istanbul ignore next: not testing real mail in tests */
	private isUploaderAuthor(uploader: User, authors: ContentAuthor[]) {
		const uploaderId = uploader._id || uploader;
		for (let i = 0; i < authors.length; i++) {
			const authorId = (authors[i]._user as User)._id || authors[i]._user;
			if (authorId.equals(uploaderId)) {
				return true;
			}
		}
		return false;
	}
}

export const mailer = new Mailer();