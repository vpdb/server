/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/legacy/superagent-test');
const hlp = require('../../test/legacy/helper');

superagentTest(request);

describe('The VPDB `IPDB` API', function() {

	describe('when fetching game details', function() {

		before(function (done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function (done) {
			hlp.cleanup(request, done);
		});

		it('should successfully fetch the data', function(done) {
			request
				.get('/api/v1/ipdb/4032')
				.as('moderator')
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.ipdb.number).to.be(4032);
					expect(res.body.ipdb.mfg).to.be(349);
					expect(res.body.ipdb.rating).to.be.ok();
					expect(res.body.title).to.be('Medieval Madness');
					expect(res.body.manufacturer).to.be('Williams');
					expect(res.body.model_number).to.be('50059');
					expect(res.body.year).to.be(1997);
					expect(res.body.game_type).to.be('ss');
					expect(res.body.short).to.be.an('array');
					expect(res.body.short).to.contain('MM');
					expect(res.body.produced_units).to.be(4016);
					expect(res.body.themes).to.be.an('array');
					expect(res.body.themes).to.contain('Fantasy');
					expect(res.body.themes).to.contain('Medieval');
					expect(res.body.themes).to.contain('Wizards/Magic');
					expect(res.body.designers).to.be.an('array');
					expect(res.body.designers).to.contain('Brian Eddy');
					expect(res.body.artists).to.be.an('array');
					expect(res.body.artists).to.contain('John Youssi');
					expect(res.body.animators).to.be.an('array');
					expect(res.body.animators).to.contain('Adam Rhine');
					expect(res.body.animators).to.contain('Brian Morris');
					expect(res.body.features).to.contain('pop-up trolls');
					expect(res.body.notes).to.contain('Ye Olde Medieval Madness');
					expect(res.body.toys).to.contain('Exploding castle');
					expect(res.body.slogans).to.contain('Behold the Renaissance of Pinball');
					done();
			});
		});

		it('should fail for a non-existent IPDB number', function(done) {
			request
				.get('/api/v1/ipdb/999999')
				.as('moderator')
				.end(hlp.status(404, 'does not exist', done));
		});

	});
});