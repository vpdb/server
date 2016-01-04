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

describe('The VPDB `Messages` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ] },
			subscribed: { roles: [ 'member' ], _plan: 'subscribed' },
			vip: { roles: [ 'member' ], _plan: 'vip' }
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	it('should deny access where plan is unsupported', function(done) {
		request
			.post('/api/v1/messages/authenticate')
			.as('member')
			.send({ socket_id: '123', channel_name: 'abcd' })
			.end(hlp.status(403, 'access denied', done));
	});

	it('should grant access where plan is supported', function(done) {
		request
			.post('/api/v1/messages/authenticate')
			.as('vip')
			.send({ socket_id: '123', channel_name: 'abcd' })
			.end(hlp.status(404, 'api not enabled', done));
	});

});