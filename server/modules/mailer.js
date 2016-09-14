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

exports.registrationConfirmation = function(user, done) {

	mail(user, 'registration-confirmation', user.email, 'Please confirm your email', done);
};

exports.emailUpdateConfirmation = function(user, done) {

	mail(user, 'email-update-confirmation', user.email_status.value, 'Please confirm your email', done);
};

exports.welcomeLocal = function(user, done) {

	mail(user, 'welcome-local', user.email, 'Welcome to the VPDB!', done);
};

exports.releaseSubmitted = function(user, release) {
	return sendEmail(user, user.email, 'Your release for ' + release._game.title + ' has been submitted', 'release-submitted', {
		user: user,
		previewUrl: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
	}, 'notify_release_moderation_status');
};

exports.releaseApproved = function(user, release, message) {
	// TODO handle message
	return sendEmail(user, 'Your release for ' + release._game.title + ' has been accepted!', 'release-approved', {
		user: user,
		message: message,
		url: settings.webUri('/games/' + release._game.id + '/releases/' + release.id)
	}, 'notify_release_moderation_status');
};

exports.releaseRefused = function(user, release, message) {
	return sendEmail(user, 'There was a problem with the release you\'ve uploaded to VPDB', 'release-refused', {
		user: user,
		message: message,
	}, 'notify_release_moderation_status');
};

exports.backglassSubmitted = function(user, backglass) {
	return sendEmail(user, user.email, 'Your backglass for ' + backglass._game.title + ' has been submitted', 'backglass-submitted', {
		user: user,
		backglass: backglass
	}, 'notify_backglass_moderation_status');
};

exports.backglassApproved = function(user, release, message) {
	// TODO handle message
	return sendEmail(user, 'Your backglass for ' + backglass._game.title + ' has been accepted!', 'backglass-approved', {
		user: user,
		message: message,
		gameUrl: settings.webUri('/games/' + release._game.id)
	}, 'notify_backglass_moderation_status');
};

exports.backglassRefused = function(user, release, message) {
	return sendEmail(user, 'There was a problem with the backglass you\'ve uploaded to VPDB', 'backglass-refused', {
		user: user,
		message: message,
	}, 'notify_backglass_moderation_status');
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
		const text = tpl(templateData);

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