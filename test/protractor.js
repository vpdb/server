"use strict"; /* global jasmine */

exports.config = {
	seleniumAddress: 'http://localhost:4444/wd/hub',
	specs: [ 'e2e/**/*.spec.js' ],
	baseUrl: 'http://localhost:7357',

	capabilities: {
		'browserName': 'chrome'
	},

	jasmineNodeOpts: {
		showColors: true
	}
};