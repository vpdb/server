"use strict";  /* global browser, element, by */

var _ = require('lodash');

function AbstractPage() {
	this.menuHome = element.all(by.css('.navbar-nav > li > a')).get(0);
	this.menuGames = element.all(by.css('.navbar-nav > li > a')).get(1);
}

/**
 * Opens this page in the browser.
 *
 * @returns {AbstractPage}
 */
AbstractPage.prototype.get = function() {
	return browser.get(this.path || '/');
};

AbstractPage.prototype.title = function() {
	return browser.getTitle();
};

module.exports = AbstractPage;