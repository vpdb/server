"use strict";

var _ = require('lodash');
var path = require('path');
var async = require('async');
var faker = require('faker');
var expect = require('expect.js');

exports.createRelease = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('contributor', request, function(game) {
		hlp.file.createVpt(user, request, function(vptfile) {
			hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: faker.company.catchPhraseAdjective() + ' Edition',
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
						var release = res.body;
						release.game = game;
						done(release);
					});
			});
		});
	});
};

exports.createRelease2 = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('contributor', request, function(game) {
		hlp.file.createVpts(user, request, 2, function(vptfiles) {
			hlp.file.createPlayfield(user, request, 'fs', function(playfieldFs) {
				hlp.file.createPlayfield(user, request, 'ws', function(playfieldWs) {
					request
						.post('/api/v1/releases')
						.as(user)
						.send({
							name: faker.company.catchPhraseAdjective() + ' Edition',
							_game: game.id,
							versions: [
								{
									files: [{
										_file: vptfiles[0].id,
										_media: {playfield_image: playfieldFs.id},
										_compatibility: ['9.9.0'],
										_tags: ['wip', 'dof'],
										flavor: {orientation: 'fs', lightning: 'night'}
									}, {
										_file: vptfiles[1].id,
										_media: {playfield_image: playfieldWs.id},
										_compatibility: ['9.9.0'],
										_tags: ['dof'],
										flavor: {orientation: 'ws', lightning: 'day'}
									}],
									version: '1.0'
								}
							],
							authors: [{_user: hlp.getUser(user).id, roles: ['Table Creator']}]
						})
						.end(function(err, res) {
							hlp.doomRelease(user, res.body.id);
							var release = res.body;
							release.game = game;
							done(release);
						});
				});
			});
		});
	});
};

exports.createRelease3 = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('contributor', request, function(game) {
		hlp.file.createVpts(user, request, 3, function(vptfiles) {
			hlp.file.createPlayfields(user, request, 'fs', 3, function(playfields) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: faker.company.catchPhraseAdjective() + ' Edition',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfiles[0].id,
									_media: { playfield_image: playfields[0].id },
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'fs', lightning: 'any' }
								}, {
									_file: vptfiles[1].id,
									_media: { playfield_image: playfields[1].id },
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'any', lightning: 'night' }
								}, {
									_file: vptfiles[2].id,
									_media: { playfield_image: playfields[2].id },
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'any', lightning: 'any' }
								} ],
								version: '2.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.doomRelease(user, res.body.id);
						var release = res.body;
						release.game = game;
						done(release);
					});
			});
		});
	});
};

exports.createReleases = function(user, request, count, done) {
	// do this in serie
	async.timesSeries(count, function(n, next) {
		switch (n) {
			case 1:
				exports.createRelease2(user, request, function(release) {
					next(null, release);
				});
				break;
			case 2:
				exports.createRelease3(user, request, function(release) {
					next(null, release);
				});
				break;
			default:
				exports.createRelease(user, request, function(release) {
					next(null, release);
				});
				break;
		}

	}, function(err, releases) {
		expect(releases).to.be.an('array');
		expect(releases).to.have.length(count);
		done(releases);
	});
};
