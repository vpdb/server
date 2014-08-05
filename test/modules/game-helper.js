"use strict";

var _ = require('underscore');
var path = require('path');

var ipdb = require(path.resolve(__dirname, '../../data/ipdb.json'));

exports.getGame = function(attrs) {
	var game = popRandomGame();
	if (game.short) {
		game.id = game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	} else {
		game.id = game.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	}
	game.year = game.year || 1900;
	game.manufacturer = game.manufacturer || 'unknown';

	return attrs ? _.extend(game, attrs) : game;
};

function popRandomGame() {
	return ipdb.splice(randomInt(ipdb.length), 1)[0];
}

function randomInt(max) {
	return Math.floor(Math.random() * max - 1) + 1;
}