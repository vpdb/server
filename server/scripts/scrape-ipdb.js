"use strict";

var fs = require('fs');
var async = require('async');

var ipdb = require('../modules/ipdb');

var stopAfter = 5000;
var wait = 1200;
var dataFile = '../../data/ipdb.json';
var data = fs.existsSync(dataFile) ? require(dataFile) : [];

var n = 0;
var id = data.length > 0 ? data[data.length - 1].ipdb.number + 1 : 1;
var dead = [ 10, 19, 52, 60 ];

async.whilst(function() {
	return n < stopAfter;
}, function(next) {
	if (~dead.indexOf(id)) {
		console.log('Skipping dead ID %d.', id);
		id++;
		return next();
	}
	ipdb.details(id, function(err, game) {
		if (err) {
			if (/^empty page/i.test(err)) {
				console.warn('Empty page, skipping.');
				n++;
				id++;
				return next();
			}
			return next(err);
		}
		data.push(game);
		fs.writeFileSync(dataFile, JSON.stringify(data, null, '\t'));
		n++;
		id++;
		setTimeout(next, wait);
	});
}, function(err) {
	if (err) {
		console.error('ERROR: %s', err);
	} else {
		console.info('Done!');
	}
});
