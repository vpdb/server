"use strict";  /* global browser */

var util = require('util');

var AbstractPage = require('../abstract.page');

function GameListPage() {
	AbstractPage.call(this);
	this.path = '/games';
	this.pageTitle = 'Games';
}

util.inherits(GameListPage, AbstractPage);

module.exports = GameListPage;
