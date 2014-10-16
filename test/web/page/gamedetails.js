"use strict";  /* global browser */

var util = require('util');

var AbstractPage = require('./abstract');

function GameDetailsPage() {
	AbstractPage.call(this);
	this.expectedPath = '/games/';
}

util.inherits(GameDetailsPage, AbstractPage);

module.exports = GameDetailsPage;
