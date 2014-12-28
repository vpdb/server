/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var fs = require('fs');
var path = require('path');
var logger = require('winston');
var nodemailer = require('nodemailer');
var handlebars = require('handlebars');
var smtpTransport = require('nodemailer-smtp-transport');

var settings = require('./settings');
var config = settings.current;

var templatesDir = path.resolve(__dirname, '../templates');

exports.confirmation = function(user, done) {

	done = done || function() {};

	// generate content
	var tpl = handlebars.compile(fs.readFileSync(path.resolve(templatesDir, 'confirmation-email.handlebars')).toString());
	var text = tpl({
		user: user,
		site: settings.webUri(),
		confirmationUrl: settings.webUri('/confirm/' + user.email_status.token),
		recipient: user.email
	});

	// setup email
	var email = {
		from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
		to: { name: user.name, address: user.email },
		subject: 'Please confirm your email',
		text: text
	};

	// send email
	var transport = nodemailer.createTransport(smtpTransport(config.vpdb.email.nodemailer));
	logger.info('[mailer] Sending confirmation email to <%s>...', user.email);
	transport.sendMail(email, function(err, status) {
		if (err) {
			logger.error('[mailer] Error sending confirmation mail to <%s>:', user.email, status);
			return done(err);
		}
		logger.info('[mailer] Successfully sent confirmation mail to <%s> with message ID "%s" (%s).', user.email, status.messageId, status.response);
		done(null, status);
	});

};
