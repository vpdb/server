"use strict";

var _ = require('underscore');
var path = require('path');
var async = require('async');
var expect = require('expect.js');

var ipdb = require(path.resolve(__dirname, '../../data/ipdb.json'));

exports.getGame = function(attrs) {
	var game = popRandomGame();
	if (game.short) {
		game.id = game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	} else {
		game.id = game.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	}
	game.year = game.year || 1900;
	game.game_type = game.game_type || 'na';
	game.manufacturer = game.manufacturer || 'unknown';

	return attrs ? _.extend(game, attrs) : game;
};

exports.createGame = function(user, request, done) {
	var hlp = require('./helper');
	hlp.file.createBackglass(user, request, function(backglass) {
		request
			.post('/api/games')
			.as(user)
			.send(exports.getGame({ _media: { backglass: backglass.id }}))
			.end(function(err, res) {
				hlp.expectStatus(err, res, 201);
				hlp.doomGame(user, res.body.id);
				done(res.body);
			});
	});
};

exports.createGames = function(user, request, count, done) {
	// do this in serie
	async.timesSeries(count, function(n, next) {
		exports.createGame(user, request, function(game) {
			next(null, game);
		});
	}, function(err, games) {
		expect(games).to.be.an('array');
		expect(games).to.have.length(count);
		done(games);
	});
};

function popRandomGame() {
	return ipdb.splice(randomInt(ipdb.length), 1)[0];
}

function randomInt(max) {
	return Math.floor(Math.random() * max - 1) + 1;
}