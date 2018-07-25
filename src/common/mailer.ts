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
import handlebars from 'handlebars';
import { flatten, isEmpty, uniqWith, upperFirst } from 'lodash';
import nodemailer, { SentMessageInfo } from 'nodemailer';
import Mail, { Address } from 'nodemailer/lib/mailer';
import { resolve } from 'path';

import { promisify } from 'util';
import { BackglassDocument } from '../backglasses/backglass.document';
import { GameDocument } from '../games/game.document';
import { ReleaseDocument } from '../releases/release.doument';
import { ReleaseVersionFileDocument } from '../releases/version/file/release.version.file.document';
import { ReleaseVersionDocument } from '../releases/version/release.version.document';
import { state } from '../state';
import { ContentAuthor } from '../users/content.author';
import { UserDocument } from '../users/user.document';
import { logger } from './logger';
import { config, settings } from './settings';
import { RequestState } from './typings/context';

const readFileAsync = promisify(readFile);
const templatesDir = resolve(__dirname, './email-templates');

class Mailer {

	public async registrationConfirmation(requestState: RequestState, user: UserDocument): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'Please confirm your email', 'registration-confirmation', {
			user,
			site: settings.webUri(),
			confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
			recipient: user.email,
		});
	}

	public async emailUpdateConfirmation(requestState: RequestState, user: UserDocument): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'Please confirm your email', 'email-update-confirmation', {
			user,
			site: settings.webUri(),
			confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
			recipient: user.email,
		});
	}

	public async welcomeLocal(requestState: RequestState, user: UserDocument): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'Welcome to the VPDB!', 'welcome-local', { user });
	}

	public async welcomeOAuth(requestState: RequestState, user: UserDocument): Promise<SentMessageInfo> {
		const strategyNames: { [key: string]: string } = {
			github: 'GitHub',
			google: 'Google',
			gameex: 'GameEx',
		};
		return this.sendEmail(requestState, user, 'Welcome to the VPDB!', 'welcome-oauth', {
			user,
			profileUrl: settings.webUri('/profile/settings'),
			strategy: strategyNames[user.provider] || upperFirst(user.provider),
		});
	}

	public async releaseAutoApproved(requestState: RequestState, user: UserDocument, release: ReleaseDocument): Promise<SentMessageInfo[]> {
		const game = release._game as GameDocument;
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id },
		}).exec();
		const results: SentMessageInfo[] = [];
		for (const moderator of moderators) {
			const result = await this.sendEmail(requestState, moderator, 'A new release has been auto-approved for ' + game.title, 'moderator-release-auto-approved', {
				user,
				moderator,
				release,
				game: release._game,
				url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
			}, 'moderator_notify_release_auto_approved');
			results.push(result);
		}
		return results;
	}

	public async releaseSubmitted(requestState: RequestState, user: UserDocument, release: ReleaseDocument): Promise<SentMessageInfo[]> {
		const game = release._game as GameDocument;
		const results: SentMessageInfo[] = [];
		// send to submitter
		let result = await this.sendEmail(requestState, user, 'Your release for ' + game.title + ' has been submitted', 'release-submitted', {
			user,
			previewUrl: settings.webUri('/games/' + game.id + '/releases/' + release.id),

		}, 'notify_release_moderation_status');
		results.push(result);
		// send to moderators
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id },
		}).exec();

		for (const moderator of moderators) {
			result = await this.sendEmail(requestState, moderator, 'A new release has been submitted for ' + game.title, 'moderator-release-submitted', {
				user,
				moderator,
				release,
				game: release._game,
				previewUrl: settings.webUri('/games/' + game.id + '/releases/' + release.id),
			}, 'moderator_notify_release_submitted');
			results.push(result);
		}
		return results;
	}

	public async releaseApproved(requestState: RequestState, user: UserDocument, release: ReleaseDocument, message: string): Promise<SentMessageInfo> {
		const game = release._game as GameDocument;
		return this.sendEmail(requestState, user, 'Your release for ' + game.title + ' has been approved!', 'release-approved', {
			user,
			release,
			game: release._game,
			message: this.wrapMessage(message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
		}, 'notify_release_moderation_status');
	}

	public async releaseRefused(requestState: RequestState, user: UserDocument, release: ReleaseDocument, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'There was a problem with the release you\'ve uploaded to VPDB', 'release-refused', {
			user,
			release,
			game: release._game,
			message: this.wrapMessage(message),
		}, 'notify_release_moderation_status');
	}

	public async releaseAdded(requestState: RequestState, uploader: UserDocument, author: UserDocument, release: ReleaseDocument): Promise<SentMessageInfo> {
		const game = release._game as GameDocument;
		const authorType = this.isUploaderAuthor(uploader, release.authors) ? 'co-author' : 'author';
		return this.sendEmail(requestState, author, 'A new release for ' + game.title + ' has been uploaded', 'release-author-new-release', {
			user: author,
			uploader,
			release,
			game: release._game,
			authorType,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
		});
	}

	public async releaseVersionAdded(requestState: RequestState, uploader: UserDocument, author: UserDocument, release: ReleaseDocument, version: ReleaseVersionDocument): Promise<SentMessageInfo> {
		const game = release._game as GameDocument;
		return this.sendEmail(requestState, author, 'A new version for "' + release.name + '" of ' + game.title + ' has been uploaded', 'release-author-new-version', {
			user: author,
			uploader,
			release,
			version,
			changes: this.wrapMessage(version.changes),
			game: release._game,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
		});
	}

	public async releaseFileAdded(requestState: RequestState, uploader: UserDocument, author: UserDocument, release: ReleaseDocument, version: ReleaseVersionDocument, versionFile: ReleaseVersionFileDocument): Promise<SentMessageInfo> {
		const game = release._game as GameDocument;
		const file = await state.models.File.findById(versionFile._file).exec();
		return this.sendEmail(requestState, author, 'A new file for v' + version.version + ' of "' + release.name + '" of ' + game.title + ' has been uploaded', 'release-author-new-file', {
			user: author,
			uploader,
			release,
			version,
			file,
			changes: this.wrapMessage(version.changes),
			game: release._game,
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
		});
	}

	public async backglassSubmitted(requestState: RequestState, user: UserDocument, backglass: BackglassDocument): Promise<SentMessageInfo[]> {
		const game = backglass._game as GameDocument;
		const results: SentMessageInfo[] = [];
		let result = await this.sendEmail(requestState, user, 'Your backglass for ' + game.title + ' has been submitted', 'backglass-submitted', {
			user,
			backglass,
		}, 'notify_backglass_moderation_status');
		results.push(result);
		// send to moderators
		const moderators = await state.models.User.find({
			roles: { $in: ['moderator', 'root'] },
			id: { $ne: user.id },
		}).exec();
		for (const moderator of moderators) {
			result = await this.sendEmail(requestState, moderator, 'A new backglass has been submitted for ' + game.title, 'moderator-backglass-submitted', {
				user,
				moderator,
				game: backglass._game,
				uploadsUrl: settings.webUri('/admin/uploads'),
			}, 'moderator_notify_backglass_submitted');
			results.push(result);
		}
		return results;
	}

	public async backglassAutoApproved(requestState: RequestState, user: UserDocument, backglass: BackglassDocument): Promise<SentMessageInfo[]> {
		const results: SentMessageInfo[] = [];
		const game = backglass._game as GameDocument;
		const moderators = await state.models.User.find({ roles: { $in: ['moderator', 'root'] }, id: { $ne: user.id } });
		let result: SentMessageInfo;
		for (const moderator of moderators) {
			result = await this.sendEmail(requestState, moderator, 'A new backglass has been auto-approved for ' + game.title, 'moderator-backglass-auto-approved', {
				user,
				moderator,
				game: backglass._game,
				url: settings.webUri('/games/' + game.id),
			}, 'moderator_notify_backglass_auto_approved');
			results.push(result);
		}
		return results;
	}

	public async backglassApproved(requestState: RequestState, user: UserDocument, backglass: BackglassDocument, message: string): Promise<SentMessageInfo> {
		const game = backglass._game as GameDocument;
		return this.sendEmail(requestState, user, 'Your backglass for ' + game.title + ' has been approved!', 'backglass-approved', {
			user,
			message: this.wrapMessage(message),
			game: backglass._game,
			gameUrl: settings.webUri('/games/' + game.id),
		}, 'notify_backglass_moderation_status');
	}

	public async backglassRefused(requestState: RequestState, user: UserDocument, backglass: BackglassDocument, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'There was a problem with the backglass you\'ve uploaded to VPDB', 'backglass-refused', {
			user,
			game: backglass._game,
			message: this.wrapMessage(message),
		}, 'notify_backglass_moderation_status');
	}

	public async gameRequestProcessed(requestState: RequestState, user: UserDocument, game: GameDocument): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, '"' + game.title + '" has been added to VPDB!', 'game-request-processed', {
			user,
			game,
			url: settings.webUri('/games/' + game.id),
		}, 'notify_game_requests');
	}

	public async gameRequestDenied(requestState: RequestState, user: UserDocument, gameTitle: string, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'About "' + gameTitle + '" you wanted to be added to VPDB...', 'game-request-denied', {
			user,
			gameTitle,
			message: this.wrapMessage(message),
		}, 'notify_game_requests');
	}

	public async releaseCommented(requestState: RequestState, user: UserDocument, commentor: UserDocument, game: GameDocument, release: ReleaseDocument, message: string): Promise<SentMessageInfo> {
		return this.sendEmail(requestState, user, 'New reply to your "' + release.name + '" of ' + game.title, 'release-commented', {
			user,
			release,
			game,
			commentor,
			message: this.wrapMessage(message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
			profileUrl: settings.webUri('/profile/notifications'),
		}, 'notify_created_release_comments');
	}

	public async releaseValidated(requestState: RequestState, user: UserDocument, moderator: UserDocument, game: GameDocument, release: ReleaseDocument, file: ReleaseVersionFileDocument): Promise<SentMessageInfo> {
		const data = {
			user,
			moderator,
			file: file.file,
			game,
			release,
			message: this.wrapMessage(file.validation.message),
			url: settings.webUri('/games/' + game.id + '/releases/' + release.id + '?show-moderation'),
		};
		switch (file.validation.status) {
			case 'verified':
				return this.sendEmail(requestState, user, 'Congrats, "' + file.file.name + '" has been validated!', 'validation-release-verified', data, 'notify_release_validation_status');
			case 'playable':
				return this.sendEmail(requestState, user, 'Your file "' + file.file.name + '" has been validated.', 'validation-release-playable', data, 'notify_release_validation_status');
			case 'broken':
				return this.sendEmail(requestState, user, 'There is an issue with "' + file.file.name + '".', 'validation-release-broken', data, 'notify_release_validation_status');
		}
	}

	public async releaseModerationCommented(requestState: RequestState, user: UserDocument, release: ReleaseDocument, message: string): Promise<SentMessageInfo[]> {
		const results: SentMessageInfo[] = [];
		const moderators = await state.models.User.find({ roles: { $in: ['moderator', 'root'] } }).exec();
		const comments = await state.models.Comment.find({ '_ref.release_moderation': release._id }).populate('_from').exec();
		const participants = comments.map(c => c._from as UserDocument);

		const all: UserDocument[] = uniqWith([...moderators, ...participants, release._created_by as UserDocument], (u1: UserDocument, u2: UserDocument) => u1.id === u2.id);
		const isApproved = release.moderation && release.moderation.is_approved;
		for (const dest of all.filter(u => u.id !== user.id)) {
			const isDestMod = moderators.includes(dest);
			const isSenderMod = user.hasRole(['moderator', 'root']);
			const isDestParticipant = participants.includes(dest);
			const game = release._game as GameDocument;

			const subject = isDestMod ?
				'New comment on "' + release.name + '" of ' + game.title :
				'Comment about your submitted "' + release.name + '" of ' + game.title;

			const result = await this.sendEmail(requestState, dest, subject, 'release-moderation-commented', {
				user: dest,
				who: isSenderMod ? 'Moderator' : 'Uploader',
				what: isSenderMod ? (isDestMod ? (release._created_by as UserDocument).name + '\'s' : 'your') : 'his',
				release,
				game,
				commentor: user,
				message: this.wrapMessage(message),
				url: settings.webUri('/games/' + game.id + '/releases/' + release.id + (isApproved ? '?show-moderation' : '')),
			}, isDestParticipant || !isDestMod ? null : 'moderator_notify_release_commented');
			results.push(result);
		}
		return results;
	}

	public async userMergedKept(requestState: RequestState, userKept: UserDocument, userMerged: UserDocument, message: string): Promise<SentMessageInfo> {
		const subject = 'Another VPDB account has been merged into yours';
		return this.sendEmail(requestState, userKept, subject, 'user-merged-kept', {
			user: userKept,
			userDeleted: userMerged,
			message,
		});
	}

	public async userMergedDeleted(requestState: RequestState, userKept: UserDocument, userMerged: UserDocument, message: string): Promise<SentMessageInfo> {
		const subject = 'Your VPDB account has been merged into another one';
		return this.sendEmail(requestState, userKept, subject, 'user-merged-deleted', {
			user: userMerged,
			userKept,
			message,
		});
	}

	/**
	 * Sends an email.
	 *
	 * @param requestState
	 * @param {UserDocument} user Recipient
	 * @param {string} subject Subject of the email
	 * @param {string} template Name of the Handlebars template, without path or extension
	 * @param {object} templateData Data passed to the Handlebars renderer
	 * @param {string} [enabledFlag] If set, user profile must have this preference set to true
	 * @return Promise<SentMessageInfo>
	 */
	private async sendEmail(requestState: RequestState, user: UserDocument, subject: string, template: string, templateData: object, enabledFlag: string = null): Promise<SentMessageInfo> {

		const what = template.replace(/-/g, ' ');
		if (!this.emailEnabled(user, enabledFlag)) {
			logger.info(requestState, '[mailer.sendEmail] NOT sending %s email to <%s>.', what, user.email);
			return;
		}

		// generate content
		const tpl = await this.getTemplate(template);
		const text = this.wrap(tpl(templateData), 60);

		// setup email
		const email: Mail.Options = {
			from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
			to: { name: user.name, address: user.email },
			subject,
			text,
		};

		// create reusable transporter object using the default SMTP transport
		const transport = nodemailer.createTransport(config.vpdb.email.nodemailer);
		logger.info(requestState, '[mailer.sendEmail] Sending %s email to <%s>...', what, (email.to as Address).address);
		const status = await transport.sendMail(email);

		if (status.messageId) {
			logger.info(requestState, '[mailer.sendEmail] Successfully sent %s mail to <%s> with message ID "%s" (%s).', what, (email.to as Address).address, status.messageId, status.response);
		} else {
			logger.info(requestState, '[mailer.sendEmail] Failed sending %s mail to <%s>: %s.', what, (email.to as Address).address, status.response);
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
	 * @param {UserDocument} user User object of the recipient
	 * @param {string} [pref] If set, user.preferences[param] must be true
	 * @returns {boolean} True if email should be sent, false otherwise
	 */
	private emailEnabled(user: UserDocument, pref: string) {
		if (isEmpty(config.vpdb.email.nodemailer)) {
			return false;
		}
		/* istanbul ignore if: Email is disabled in tests */
		if (!pref) {
			return true;
		}
		/* istanbul ignore if: Email is disabled in tests */
		if (!user.preferences) {
			return true;
		}
		/* istanbul ignore next: Email is disabled in tests */
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
				const match = line.match(reMatch);
				return match[0].trim() ? match : line;
			}
			return line;
		}));
		return indent + lines.join(newline);
	}

	/* istanbul ignore next: not testing real mail in tests */
	private isUploaderAuthor(uploader: UserDocument, authors: ContentAuthor[]) {
		const uploaderId = uploader._id || uploader;
		for (const author of authors) {
			const authorId = author._user._id;
			if (authorId.equals(uploaderId)) {
				return true;
			}
		}
		return false;
	}
}

export const mailer = new Mailer();
