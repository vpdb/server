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

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var logger = require('winston');
var nodemailer = require('nodemailer');
var handlebars = require('handlebars');
var smtpTransport = require('nodemailer-smtp-transport');

var settings = require('./settings');
var config = settings.current;

var templatesDir = path.resolve(__dirname, '../email-templates');

exports.registrationConfirmation = function(user) {
	return sendEmail(user, 'Please confirm your email', 'registration-confirmation', {
		user: user,
		site: settings.webUri(),
		confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
		recipient: user.email
	});
};

exports.emailUpdateConfirmation = function(user, done) {

	mail(user, 'email-update-confirmation', user.email_status.value, 'Please confirm your email', done);
};

exports.welcomeLocal = function(user, done) {

	mail(user, 'welcome-local', user.email, 'Welcome to the VPDB!', done);
};

exports.welcomeOAuth = function(user) {
	const strategyNames = {
		github: 'GitHub',
		google: 'Google',
		gameex: 'GameEx'
	};
	return sendEmail(user, 'Welcome to the VPDB!', 'welcome-oauth', {
		user: user,
		profileUrl: settings.webUri('/profile/settings'),
		strategy: strategyNames[user.provider] || _.upperFirst(user.provider)
	});
};

exports.releaseAutoApproved = function(user, release) {
	const User = require('mongoose').model('User');
	return User.find({ roles: { $in: [ 'moderator', 'root' ]}, id: { $ne: user.id }}).exec().then(moderators => {
		return Promise.each(moderators, moderator => {
			return sendEmail(moderator, 'A new release has been auto-approved for ' + release._game.title, 'moderator-release-auto-approved', {
				user: user,
				moderator: moderator,
				release: release,
				game: release._game,
				url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
			}, 'moderator_notify_release_auto_approved');
		});
	});
};

exports.releaseSubmitted = function(user, release) {
	// send to submitter
	return sendEmail(user, 'Your release for ' + release._game.title + ' has been submitted', 'release-submitted', {
		user: user,
		previewUrl: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)

	}, 'notify_release_moderation_status').then(() => {
		// send to moderators
		const User = require('mongoose').model('User');
		return User.find({ roles: { $in: [ 'moderator', 'root' ]}, id: { $ne: user.id }}).exec().then(moderators => {
			return Promise.each(moderators, moderator => {
				return sendEmail(moderator, 'A new release has been submitted for ' + release._game.title, 'moderator-release-submitted', {
					user: user,
					moderator: moderator,
					release: release,
					game: release._game,
					previewUrl: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
				}, 'moderator_notify_release_submitted');
			});
		});
	});
};

exports.releaseApproved = function(user, release, message) {
	return sendEmail(user, 'Your release for ' + release._game.title + ' has been approved!', 'release-approved', {
		user: user,
		release: release,
		game: release._game,
		message: wrapMessage(message),
		url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
	}, 'notify_release_moderation_status');
};

exports.releaseRefused = function(user, release, message) {
	return sendEmail(user, 'There was a problem with the release you\'ve uploaded to VPDB', 'release-refused', {
		user: user,
		release: release,
		game: release._game,
		message: wrapMessage(message),
	}, 'notify_release_moderation_status');
};

exports.releaseAdded = function(uploader, author, release) {
	const authorType = isUploaderAuthor(uploader, release.authors) ? 'co-author' : 'author';
	return sendEmail(author, 'A new release for ' + release._game.title + ' has been uploaded', 'release-author-new-release', {
		user: author,
		uploader: uploader,
		release: release,
		game: release._game,
		authorType: authorType,
		url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
	});
};

exports.releaseVersionAdded = function(uploader, author, release, version) {
	return sendEmail(author, 'A new version for "' + release.name + '" of ' + release._game.title + ' has been uploaded', 'release-author-new-version', {
		user: author,
		uploader: uploader,
		release: release,
		version: version,
		changes: wrapMessage(version.changes),
		game: release._game,
		url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
	});
};

exports.releaseFileAdded = function(uploader, author, release, version, versionFile) {
	const File = require('mongoose').model('File');
	return Promise.try(() => {
		return File.findById(versionFile._file).exec();
	}).then(file => {
		return sendEmail(author, 'A new file for v' + version.version + ' of "' + release.name + '" of ' + release._game.title + ' has been uploaded', 'release-author-new-file', {
			user: author,
			uploader: uploader,
			release: release,
			version: version,
			file: file,
			changes: wrapMessage(version.changes),
			game: release._game,
			url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
		});
	});
};

exports.backglassSubmitted = function(user, backglass) {
	return sendEmail(user, 'Your backglass for ' + backglass._game.title + ' has been submitted', 'backglass-submitted', {
		user: user,
		backglass: backglass
	}, 'notify_backglass_moderation_status').then(() => {
		// send to moderators
		const User = require('mongoose').model('User');
		return User.find({ roles: { $in: [ 'moderator', 'root' ]}, id: { $ne: user.id }}).exec().then(moderators => {
			return Promise.each(moderators, moderator => {
				return sendEmail(moderator, 'A new backglass has been submitted for ' + backglass._game.title, 'moderator-backglass-submitted', {
					user: user,
					moderator: moderator,
					game: backglass._game,
					uploadsUrl: settings.webUri('/admin/uploads')
				}, 'moderator_notify_backglass_submitted');
			});
		});
	});
};

exports.backglassAutoApproved = function(user, backglass) {
	const User = require('mongoose').model('User');
	return User.find({ roles: { $in: [ 'moderator', 'root' ]}, id: { $ne: user.id }}).exec().then(moderators => {
		return Promise.each(moderators, moderator => {
			return sendEmail(moderator, 'A new backglass has been auto-approved for ' + backglass._game.title, 'moderator-backglass-auto-approved', {
				user: user,
				moderator: moderator,
				game: backglass._game,
				url: settings.webUri('/games/' + backglass._game.id)
			}, 'moderator_notify_backglass_auto_approved');
		});
	});
};

exports.backglassApproved = function(user, backglass, message) {
	return sendEmail(user, 'Your backglass for ' + backglass._game.title + ' has been approved!', 'backglass-approved', {
		user: user,
		message: wrapMessage(message),
		game: backglass._game,
		gameUrl: settings.webUri('/games/' + backglass._game.id)
	}, 'notify_backglass_moderation_status');
};

exports.backglassRefused = function(user, backglass, message) {
	return sendEmail(user, 'There was a problem with the backglass you\'ve uploaded to VPDB', 'backglass-refused', {
		user: user,
		game: backglass._game,
		message: wrapMessage(message),
	}, 'notify_backglass_moderation_status');
};

exports.gameRequestProcessed = function(user, game) {
	return sendEmail(user, '"' + game.title + '" has been added to VPDB!', 'game-request-processed', {
		user: user,
		game: game,
		url: settings.webUri('/games/' + game.id)
	}, 'notify_game_requests');
};

exports.gameRequestDenied = function(user, gameTitle, message) {
	return sendEmail(user, 'About "' + gameTitle + '" you wanted to be added to VPDB...', 'game-request-denied', {
		user: user,
		gameTitle: gameTitle,
		message: wrapMessage(message)
	}, 'notify_game_requests');
};

exports.releaseCommented = function(user, commentor, game, release, message) {
	return sendEmail(user, 'New reply to your "' + release.name + '" of ' + game.title, 'release-commented', {
		user: user,
		release: release,
		game: game,
		commentor: commentor,
		message: wrapMessage(message),
		url: settings.webUri('/games/' + game.id + '/releases/' + release.id),
		profileUrl: settings.webUri('/profile/notifications'),
	}, 'notify_created_release_comments');
};

exports.releaseValidated = function(user, moderator, game, release, file) {
	let data = {
		user: user,
		moderator: moderator,
		file: file.file,
		game: game,
		release: release,
		message: wrapMessage(file.validation.message),
		url: settings.webUri('/games/' + game.id + '/releases/' + release.id + '?show-moderation'),
	};
	switch (file.validation.status) {
		case 'verified':
			return sendEmail(user, 'Congrats, "' + file.file.name + '" has been validated!', 'validation-release-verified', data, 'notify_release_validation_status');
		case 'playable':
			return sendEmail(user, 'Your file "' + file.file.name + '" has been validated.', 'validation-release-playable', data, 'notify_release_validation_status');
		case 'broken':
			return sendEmail(user, 'There is an issue with "' + file.file.name + '".', 'validation-release-broken', data, 'notify_release_validation_status');
	}
};

exports.releaseModerationCommented = function(user, release, message) {

	const Comment = require('mongoose').model('Comment');
	const User = require('mongoose').model('User');
	let moderators, participants;
	return Promise.try(() => {
		return User.find({ roles: { $in: ['moderator', 'root'] } }).exec();

	}).then(m => {
		moderators = m;
		return Comment.find({ '_ref.release_moderation': release._id }).populate('_from').exec();

	}).then(p => {
		participants = p.map(c => c._from);
		let all = _.uniqWith([ ...moderators, ...participants, release._created_by ], (u1, u2) => u1.id === u2.id);
		const isApproved = release.moderation && release.moderation.is_approved;

		return Promise.each(all.filter(u => u.id !== user.id), dest => {
			const isDestMod = moderators.includes(dest);
			const isSenderMod = user.hasRole(['moderator', 'root']);
			const isDestParticipant = participants.includes(dest);
			const game = release._game;

			const subject = isDestMod ?
				'New comment on "' + release.name + '" of ' + game.title :
				'Comment about your submitted "' + release.name + '" of ' + game.title;

			return sendEmail(dest, subject, 'release-moderation-commented', {
				user: dest,
				who: isSenderMod ? 'Moderator' : 'Uploader',
				what: isSenderMod ? (isDestMod ? release._created_by.name + "'s" : 'your') : 'his',
				release: release,
				game: game,
				commentor: user,
				message: wrapMessage(message),
				url: settings.webUri('/games/' + game.id + '/releases/' + release.id + (isApproved ? '?show-moderation' : ''))
			}, isDestParticipant || !isDestMod ? null : 'moderator_notify_release_commented');

		});
	});
};


/**
 * Sends an email.
 *
 * @param {User} user Recepient object
 * @param {string} subject Subject of the email
 * @param {string} template Name of the Handlebars template, without path or extension
 * @param {Object} templateData Data passed to the Handlebars renderer
 * @param {string} [enabledFlag] If set, user profile must have this preference set to true
 * @return Promise
 */
function sendEmail(user, subject, template, templateData, enabledFlag) {

	let what, email;
	return Promise.try(() => {
		what = template.replace(/-/g, ' ');
		if (!emailEnabled(user, enabledFlag)) {
			logger.info('[mailer] NOT sending %s email to <%s>.', what, user.email);
			return;
		}

		// generate content
		const tpl = getTemplate(template);
		const text = wrap(tpl(templateData), 60);

		// setup email
		email = {
			from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
			to: { name: user.name, address: user.email },
			subject: subject,
			text: text
		};

		const transport = nodemailer.createTransport(smtpTransport(config.vpdb.email.nodemailer));
		logger.info('[mailer] Sending %s email to <%s>...', what, email.to.address);
		return transport.sendMail(email);

	}).then(status => {
		if (!status) {
			return;
		}
		if (status.messageId) {
			logger.info('[mailer] Successfully sent %s mail to <%s> with message ID "%s" (%s).', what, email.to.address, status.messageId, status.response);
		} else {
			logger.info('[mailer] Failed sending %s mail to <%s>: %s.', what, email.to.address, status.response);
		}
		return status;
	});
}

/**
 * Returns a Handlebar renderer for a given template name.
 * @param {string} template Template file without path or extension
 * @returns {Function} Handlebar renderer
 */
function getTemplate(template) {
	return handlebars.compile(fs.readFileSync(path.resolve(templatesDir, template + '.handlebars')).toString());
}

/**
 * Checks if an email should be sent
 * @param {User} user User object of the recipient
 * @param {string} [pref] If set, user.preferences[param] must be true
 * @returns {boolean} True if email should be sent, false otherwise
 */
function emailEnabled(user, pref) {
	if (_.isEmpty(config.vpdb.email.nodemailer)) {
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
function wrapMessage(message) {
	return message ? wrap(message, 58, '> ') : message;
}

/**
 * Wraps a text into multiple lines
 *
 * @param {string} text Text to wrap
 * @param {number} width Line width in chars
 * @param {string} [indent=''] String to prefix before each line
 * @returns {string}
 */
function wrap(text, width, indent) {
	indent = indent || '';
	const newline = '\n' + indent;
	const reTest = new RegExp('.{1,' + width + '}(\\s+|$)', 'g');
	const reMatch = new RegExp('.{1,' + width + '}(\\s+|$)|\\S+?(\\s+|$)', 'g');
	const lines = _.flatten(text.split(/\r?\n/).map(line => {
		if (reTest.test(line)) {
			let match = line.match(reMatch);
			return match[0].trim() ? match : line;
		}
		return line;
	}));
	return indent + lines.join(newline);
}

/**
 * @deprecated
 */
function mail(user, template, recipient, subject, done) {

	done = done || function() {};

	var tpl = getTemplate(template);

	// generate content
	var text = tpl({
		user: user,
		site: settings.webUri(),
		confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
		recipient: recipient
	});

	// setup email
	var email = {
		from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
		to: { name: user.name, address: recipient },
		subject: subject,
		text: text
	};

	// send email
	send(email, template.replace(/-/g, ' '), done);
}

/* istanbul ignore next: not testing real mail in tests */
/**
 * @deprecated
 */
function send(email, what, done) {

	if (_.isEmpty(config.vpdb.email.nodemailer)) {
		logger.info('[mailer] NOT sending %s email to <%s> due to environment config.', what, email.to.address);
		return done();
	}

	var transport = nodemailer.createTransport(smtpTransport(config.vpdb.email.nodemailer));
	logger.info('[mailer] Sending %s email to <%s>...', what, email.to.address);
	transport.sendMail(email, function(err, status) {
		if (err) {
			logger.error('[mailer] Error sending %s mail to <%s>:', what, email.to.address, err);
			return done(err);
		}
		logger.info('[mailer] Successfully sent %s mail to <%s> with message ID "%s" (%s).', what, email.to.address, status.messageId, status.response);
		done(null, status);
	});
}

function isUploaderAuthor(uploader, authors) {
	const uploaderId = uploader._id || uploader;
	for (let i = 0; i < authors.length; i++) {
		const authorId = authors[i]._user._id || authors[i]._user;
		if (authorId.equals(uploaderId)) {
			return true;
		}
	}
	return false;
}