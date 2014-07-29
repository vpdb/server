"use strict";

var api = require('./api');
var ipdb = require('../../modules/ipdb');
var logger = require('winston');

exports.view = function(req, res) {

	if (req.query.dryrun) {
		logger.info('[ipdb] Dry run, returning data for Monster Bash.');
		api.success(res, { ipdb: { no: 4441, mfg: 349, rating: 8.3 }, name: "Monster Bash", manufacturer: "Williams", model_number: 50065, year: 1998, type: "SS", short: [ "MB" ], units: 3361, theme: [ "Horror", "Licensed Theme" ], designers: [ "George Gomez" ], artists: [ "Kevin O'Connor" ] }, 200);
	} else {
		ipdb.details(req.params.id, function(err, game) {
			if (err) {
				api.fail(res, err, 500);
			} else {
				api.success(res, game);
			}
		});
	}
};
