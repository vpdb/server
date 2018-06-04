## Tests

We use [Mocha][mocha] for running backend API tests.

A test run requires a clean environment. For this purpose, there is an included settings file at 
`config/settings-test.js` which is used when running tests. Basically it's a stripped-down config that uses a 
different database, runs on a different HTTP port and enables code coverage.

If you want to execute the tests, run the server in test mode:

	npm run test:serve

When running in test mode, a local test coverage report is generated in the `coverage` folder. It also
drops all MongoDB collections and flushes Redis.

In order to execute the tests, run:

	npm run test:run

[mocha]: https://mochajs.org/