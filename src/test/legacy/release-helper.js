"use strict";

var _ = require('lodash');
var path = require('path');
var async = require('async');
var faker = require('faker');
var expect = require('expect.js');


exports.createReleaseForGame = function(user, request, game, opts, done) {
	if (_.isFunction(opts)) {
		done = opts;
		opts = {};
	}
	var hlp = require('./helper');
	hlp.file.createVpt(user, request, opts, function(vptfile) {
		hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
			request
				.post('/api/v1/releases')
				.as(user)
				.send({
					name: faker.company.catchPhraseAdjective() + ' Edition',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ opts.buildId ? opts.buildId : '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' } }
							],
							version: opts.version || '1.0.0'
						}
					],
					authors: [ { _user: hlp.getUser(opts.author || user).id, roles: [ 'Table Creator' ] } ]
				})
				.end(function (err, res) {
					hlp.doomRelease(user, res.body.id);
					var release = res.body;
					release.game = game;
					done(release);
				});
		});
	});
};

exports.createRelease = function(user, request, opts, done) {
	var hlp = require('./helper');
	hlp.game.createGame('moderator', request, function(game) {
		exports.createReleaseForGame(user, request, game, opts, done);
	});
};

exports.createRelease2 = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('moderator', request, function(game) {
		hlp.file.createVpts(user, request, 2, function(vptfiles) {
			hlp.file.createPlayfield(user, request, 'fs', function(playfieldFs) {
				hlp.file.createPlayfield(user, request, 'ws', function(playfieldWs) {
					request
						.post('/api/v1/releases')
						.as(user)
						.send({
							name: faker.company.catchPhraseAdjective() + ' Edition',
							license: 'by-sa',
							_game: game.id,
							versions: [
								{
									files: [{
										_file: vptfiles[0].id,
										_playfield_image: playfieldFs.id,
										_compatibility: ['9.9.0'],
										flavor: { orientation: 'fs', lighting: 'night' }
									}, {
										_file: vptfiles[1].id,
										_playfield_image: playfieldWs.id,
										_compatibility: ['9.9.0'],
										flavor: { orientation: 'ws', lighting: 'day' }
									}],
									version: '1.0'
								}
							],
							_tags: ['dof'],
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
	hlp.game.createGame('moderator', request, function(game) {
		hlp.file.createVpts(user, request, 3, function(vptfiles) {
			hlp.file.createPlayfields(user, request, 'fs', 3, function(playfields) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: faker.company.catchPhraseAdjective() + ' Edition',
						license: 'by-sa',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfiles[0].id,
									_playfield_image: playfields[0].id,
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'fs', lighting: 'any' }
								}, {
									_file: vptfiles[1].id,
									_playfield_image: playfields[1].id,
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'any', lighting: 'night' }
								}, {
									_file: vptfiles[2].id,
									_playfield_image: playfields[2].id,
									_compatibility: [ '10.x' ],
									flavor: { orientation: 'any', lighting: 'any' }
								} ],
								version: '2.0'
							}
						],
						_tags: ['wip', 'dof'],
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

exports.createRelease4 = function(user, request, done) {
	var hlp = require('./helper');
	hlp.game.createGame('moderator', request, function(game) {
		hlp.file.createVpts(user, request, 3, function(vptfiles) {
			hlp.file.createPlayfields(user, request, 'fs', 2, function(playfields) {
				hlp.file.createPlayfield(user, request, 'ws', function(playfieldWs) {
					request
						.post('/api/v1/releases')
						.as(user)
						.send({
							name: faker.company.catchPhraseAdjective() + ' Edition',
							license: 'by-sa',
							_game: game.id,
							versions: [
								{
									files: [ {
										_file: vptfiles[0].id,
										_playfield_image: playfields[0].id,
										_compatibility: [ '10.x' ],
										flavor: { orientation: 'fs', lighting: 'night' }
									}, {
										_file: vptfiles[1].id,
										_playfield_image: playfields[1].id,
										_compatibility: [ '10.x' ],
										flavor: { orientation: 'fs', lighting: 'day' }
									} ],
									version: '2.0',
									"released_at": "2015-08-30T12:00:00.000Z"
								}, {

									files: [ {
										_file: vptfiles[2].id,
										_playfield_image: playfieldWs.id,
										_compatibility: [ '10.x' ],
										flavor: { orientation: 'ws', lighting: 'night' }
									} ],
									version: '1.0',
									"released_at": "2015-07-01T12:00:00.000Z"
								}
							],
							_tags: ['wip', 'dof'],
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
			case 3:
				exports.createRelease4(user, request, function(release) {
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
