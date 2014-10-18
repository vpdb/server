exports.config = {
	seleniumAddress: 'http://localhost:4444/wd/hub',
	specs: [ 'web/*.test.js' ],
	baseUrl: 'http://localhost:7357',
	framework: 'mocha',
	mochaOpts: {
		reporter: "spec",
	}
};