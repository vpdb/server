"use strict";  /* global browser */

var util = require('util');

var AbstractPage = require('./abstract');

function GameListPage() {
	AbstractPage.call(this);
	this.path = '/games';
}

util.inherits(GameListPage, AbstractPage);

module.exports = GameListPage;
