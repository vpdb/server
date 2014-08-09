"use strict";

var fs = require('fs');
var ent = require('ent');
var path = require('path');
var expect = require('expect.js');


exports.getTokenFromHtml = function(res) {
	var match = res.text.match(/auth="([^"]+)/);
	var attr = match ? match[1] : false;
	return attr ? JSON.parse(ent.decode(attr)) : false;
};

exports.assertToken = function(request, done) {
	var hlp = require('./helper');
	return function(err, res) {
		hlp.expectStatus(err, res, 200);
		var auth = exports.getTokenFromHtml(res);
		var authHeader = res.text.match(/auth-header="([^"]+)/)[1];
		expect(authHeader).to.be.ok();
		expect(auth).to.be.an('object');
		expect(auth.jwt).to.be.ok();
		done(authHeader, auth.jwt);
	};
};

exports.assertValidToken = function(request, done, noDoom) {
	var hlp = require('./helper');
	return function(err, res) {
		exports.assertToken(request, function(header, jwt) {
			request.get('/api/user').set(header, 'Bearer ' + jwt).end(function (err, res) {
				hlp.expectStatus(err, res, 200);
				if (!noDoom) {
					hlp.doomUser(res.body.id);
				}
				done(null, res.body);
			});
		})(err, res);
	};
};