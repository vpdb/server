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

var path = require('path');
var uuid = require('node-uuid');
var nodemailer = require('nodemailer');
var emailTemplates = require('email-templates');
var smtpTransport = require('nodemailer-smtp-transport');

var settings = require('./settings');
var config = settings.current;

var templatesDir = path.resolve(__dirname, '../templates');

exports.confirmation = function(user, done) {

	emailTemplates(templatesDir, function(err, template) {

		if (err) {
			return done(err);
		}

		// Prepare nodemailer transport object
		var transport = nodemailer.createTransport(smtpTransport (config.vpdb.email.nodemailer));

		// An example users object with formatted email function
		var locals = {
			user: user,
			token: uuid.v4(),
			site: settings.webUri(),
			recipient: user.email
		};

		// Send a single email
		template('confirmation-email', locals, function(err, html, text) {
			if (err) {
				return done(err);
			}
			var email = {
				from: { name: config.vpdb.email.sender.name, address: config.vpdb.email.sender.email },
				to: { name: user.name, address: user.email },
				subject: 'Please confirm your email',
				text: text
			};
			transport.sendMail(email, function(err, responseStatus) {
				if (err) {
					return done(err);
				}
				done(null, responseStatus);
			});
		});

	});
};
