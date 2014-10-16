# Tests

We use [Mocha][mocha] for running backend API tests and [Protractor][protractor] for end-to-end webdriver tests.

A test run requires a clean environment. For this purpose, there is an included settings file at 
`server/config/settings-test.js` which is used when running tests. Basically it's a stripped-down config that uses a 
different database, runs on a different HTTP port and enables code coverage.

If you want to execute the tests, run the server in test mode:

	grunt serve-test

When running in test mode, a local test coverage report is available under [/coverage](http://localhost:7357/coverage/).


# Backend Tests
 
Backend are API tests that query the API and make sure that it returns what it's supposed to. You can run them by
executing this is a second terminal:

	grunt test --force

The `--force` parameter is necessary if you want to keep watching files for changes even though when tests are failing.
There are some additional command-line parameters:

 * `--server=<url>` - Server URL. Default: `http://localhost:7357/`.
 * `--basic-auth=<user>:<password>` - Adds a basic authentication header to every request.
 * `--auth-header=<header>` - Authorization header. Default: `Authorization`.


# Frontend Tests

Frontend tests use a real browser and test end-to-end scenarios.

You'll need protractor installed and running:

	npm install -g protractor
	webdriver-manager update
	webdriver-manager start


[mocha]: http://visionmedia.github.io/mocha/
[protractor]: http://angular.github.io/protractor/