"use strict";  /* global browser */

var util = require('util');

var AbstractPage = require('./abstract');

function HomePage() {
	AbstractPage.call(this);
	this.path = '/';
	this.pageTitle = 'Home';
}

util.inherits(HomePage, AbstractPage);

module.exports = HomePage;
