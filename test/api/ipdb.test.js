"use strict"; /* global describe, before, after, it */

var _ = require('lodash');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

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

			var user = 'moderator';
			hlp.file.createBackglass(user, request, function(backglass) {
				hlp.doomFile(user, backglass.id);
				request
					.get('/api/v1/ipdb/4032')
					.as(user)
					.send(hlp.game.getGame({ _backglass: backglass.id }))
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
						expect(res.body.artists).to.contain('Greg Freres');
						expect(res.body.features).to.contain('pop-up trolls');
						expect(res.body.notes).to.contain('Ye Olde Medieval Madness');
						expect(res.body.toys).to.contain('Exploding castle');
						expect(res.body.slogans).to.contain('Behold the Renaissance of Pinball');
						done();
					});
			});
		});

	});
});