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

function mail(user, template, recipient, subject, done) {

	done = done || function() {};

	var tpl = handlebars.compile(fs.readFileSync(path.resolve(templatesDir, template + '.handlebars')).toString());

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