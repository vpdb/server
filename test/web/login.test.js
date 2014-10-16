"use strict"; /*global describe, before, after, it, browser, element, by, expect */

var request = require('superagent');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

var GameListPage = require('./page/gamelist');

superagentTest(request);

describe('The home page', function() {

	it('should have "home" in the title.', function() {

		var gameListPage = new GameListPage();
		gameListPage.get();

		expect(gameListPage.title()).toEqual('Games');

//		element(by.model('todoText')).sendKeys('write a protractor test');
//		element(by.css('[value="add"]')).click();
//
//		var todoList = element.all(by.repeater('todo in todos'));
//		expect(todoList.count()).toEqual(3);
//		expect(todoList.get(2).getText()).toEqual('write a protractor test');
	});
});