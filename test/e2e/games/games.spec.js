"use strict"; /* global protractor, describe, ddescribe, beforeEach, afterEach, it, iit, browser, element, by, expect */

var request = require('superagent');

var superagentTest = require('../../modules/superagent-test');
var hlp = require('../../modules/helper');

var GameListPage = require('../games/games.page');

superagentTest(request);

describe('The game list page', function() {

	var user = 'contributor';
	var count = 13;
	var games = [];

	beforeEach(function(done) {
		hlp.setupUsers(request, {
			contributor: { roles: [ user ]}
		}, function() {
			hlp.game.createGames(user, request, count, function(_games) {
				games = _games;
				done();
			});
		});
	});

	afterEach(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when adding 13 games', function() {

		it('should display 12 games on the first page', function() {

			var gamesPage = new GameListPage();
			gamesPage.get();

			expect(gamesPage.gameItems.count()).toEqual(12);
			expect(gamesPage.pagination.next.isDisplayed()).toBeTruthy();

			gamesPage.pagination.next.click();
			expect(gamesPage.gameItems.count()).toEqual(1);
			expect(gamesPage.pagination.next.isDisplayed()).toBeFalsy();
		});


	});


});