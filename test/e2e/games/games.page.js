"use strict";  /* global browser, element, by */

var util = require('util');

var AbstractPage = require('../abstract.page');

function GameListPage() {
	AbstractPage.call(this);
	this.path = '/games';
	this.pageTitle = 'Games';

	this.gameItems = element.all(by.repeater('game in games'));
	this.pagination = {
		first: element(by.css('[ng-show="pagination.links.first"]')),
		prev: element(by.css('[ng-show="pagination.links.prev"]')),
		next: element(by.css('[ng-show="pagination.links.next"]')),
		last: element(by.css('[ng-show="pagination.links.last"]'))
	};
}

util.inherits(GameListPage, AbstractPage);

module.exports = GameListPage;
