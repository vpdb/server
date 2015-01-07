"use strict";

var _ = require('lodash');
var path = require('path');
var async = require('async');
var expect = require('expect.js');

exports.createRelease = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('contributor', request, function(game) {
		hlp.doomGame('contributor', game.id);
		hlp.file.createVpt(user, request, function(vptfile) {
			hlp.file.createPlayfield(user, request, function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lightning: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.doomRelease(user, res.body.id);
						done(res.body);
					});
			});
		});
	});
};

exports.createReleases = function(user, request, count, done) {
	// do this in serie
	async.timesSeries(count, function(n, next) {
		exports.createRelease(user, request, function(release) {
			next(null, release);
		});
	}, function(err, releases) {
		expect(releases).to.be.an('array');
		expect(releases).to.have.length(count);
		done(releases);
	});
};
