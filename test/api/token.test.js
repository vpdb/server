/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict"; /* global describe, before, after, it */

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Token` API', function() {

	describe('when creating a new token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if no password provided', function(done) {
			request
				.post('/api/v1/tokens')
				.saveResponse({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'Test Application' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401, 'must supply a password');
					done();
				});
		});

		it('should fail if the wrong password provided', function(done) {
			request
				.post('/api/v1/tokens')
				//.saveResponse({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'Test Application', password: 'xxx' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401, 'wrong password');
					done();
				});
		});

		it('should fail validations for empty label', function(done) {
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ label: 'x', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must contain at least');
					done();
				});
		});

		it('should succeed with valid data', function(done) {
			request
				.post('/api/v1/tokens')
				.save({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'My Application', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.token).to.be.ok();
					done();
				});
		});
	});
});