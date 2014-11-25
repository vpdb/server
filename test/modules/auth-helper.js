"use strict";

var fs = require('fs');
var path = require('path');
var expect = require('expect.js');

exports.assertToken = function(request, done, noDoom) {
	var hlp = require('./helper');
	return function (err, res) {
		hlp.expectStatus(err, res, 200);
		expect(res.body.token).to.be.ok();
		if (!noDoom) {
			hlp.doomUser(res.body.user.id);
		}
		request.get('/api/v1/user').set('Authorization', 'Bearer ' + res.body.token).end(hlp.status(200, done));
	};

};