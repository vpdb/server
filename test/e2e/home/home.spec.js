"use strict"; /* global protractor, describe, before, after, it, iit, browser, element, by, expect */

var request = require('superagent');

var superagentTest = require('../../modules/superagent-test');
var hlp = require('../../modules/helper');

var HomePage = require('./home.page');
var GameListPage = require('../games/games.page');

superagentTest(request);

describe('The home page', function() {

	it('should have "home" in the title.', function() {

		var homePage = new HomePage();
		homePage.get();

		expect(homePage.title()).toEqual(homePage.pageTitle);

	});

	it('should navigate to games', function() {

		var homePage = new HomePage();
		var gameListPage = new GameListPage();

		homePage.get().then(function() {
			homePage.menuGames.click();
			expect(homePage.title()).toEqual(gameListPage.pageTitle);
		});
	});


});