"use strict";  /* global browser */

var _ = require('lodash');

function AbstractPage() {

}

/**
 * Opens this page in the browser.
 *
 * @returns {AbstractPage}
 */
AbstractPage.prototype.get = function() {
	browser.get(this.expectedPath || '/');
	return this;
};

AbstractPage.prototype.title = function() {
	return browser.getTitle();
};

module.exports = AbstractPage;