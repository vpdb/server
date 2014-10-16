"use strict";  /* global browser, element, by */

var _ = require('lodash');

function AbstractPage() {
	this.menuHome = element(by.linkText('Home'));
	this.menuGames = element(by.css('.navbar-nav')).element(by.linkText('Games'));
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