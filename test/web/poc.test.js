"use strict"; /* global protractor, describe, before, after, it, iit, browser, element, by, expect */

var request = require('superagent');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

var HomePage = require('./page/home');
var GameListPage = require('./page/gamelist');

superagentTest(request);

describe('The home page', function() {

	var ptor = protractor.getInstance();

	iit('should navigate to games', function() {

		var homePage = new HomePage();
		var gameListPage = new GameListPage();

		homePage.get().then(function() {
			homePage.menuGames.click();
			console.log('checking %j against %s', ptor.getCurrentUrl(), gameListPage.path);
			expect(ptor.getCurrentUrl()).toEqual('/games');
		});
	});

	it('should have "home" in the title.', function() {

		var gameListPage = new GameListPage();
		gameListPage.get();

		expect(gameListPage.title()).toEqual('Games');
	});
});