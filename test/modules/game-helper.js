"use strict";

var _ = require('underscore');
var path = require('path');

var ipdb;

exports.getGame = function(attrs) {
	var game = popRandomGame();
	if (game.short) {
		game.id = game.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	} else {
		game.id = game.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
	}
	return attrs ? _.extend(game, attrs) : game;
};

function getIpdb() {
	if (!ipdb) {
		ipdb = require(path.resolve(__dirname, '../../data/ipdb.json'));
	}
	return ipdb;
}

function popRandomGame() {
	var ipdb = getIpdb();
	return ipdb.splice(randomInt(ipdb.length), 1)[0];
}

function randomInt(max) {
	return Math.floor(Math.random() * max - 1) + 1;
}