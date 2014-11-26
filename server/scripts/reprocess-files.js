"use strict";

var _ = require('lodash');
var fs = require('fs');
var http = require('http');
var path = require('path');
var util = require('util');
var mongoose = require('mongoose');

var settings = require('../modules/settings');
var config = settings.current;

var storage = require('../modules/storage');

// bootstrap db connection
mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } } });

// bootstrap models
var modelsPath = path.resolve(__dirname, '../models');
fs.readdirSync(modelsPath).forEach(function(file) {
	if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
		require(modelsPath + '/' + file);
	}
});

var User = mongoose.model('User');
var File = mongoose.model('File');

var display = function(err, res) {
	if (err) {
		return console.error('ERROR: %s', err);
	}
	console.log(util.inspect(res, false, 4, true));
};

File.find({ variations: { $exists : true, $ne : null }}, function(err, files) {
	if (err) {
		return display(err, files);
	}
	_.each(files, function(file) {
		storage.postprocess(file, true);
	});
});