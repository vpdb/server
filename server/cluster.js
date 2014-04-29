#!/usr/bin/env node

"use strict";

var fs = require('fs');
var util = require('util');
var path = require('path');
var args = require('optimist').argv;
var recluster = require('recluster');

function usage() {
	util.log('Usage : ' + process.argv[1] + ' <filename> ');
	util.log('example : cluster app.js');
}

function killAll(signal) {
	util.log('Received ' + signal + ' signal, signalling all worker processes...');
	process.kill(0, signal);
}

function startApp(filename) {

	var opts = { timeout: 30, respawn: 60 };
	var cluster = recluster(filename, opts);
	var sighupSent = false;
	var restartFile = path.resolve(process.env.RESTARTFILE || './public/system/restart');

	cluster.run();
	util.log('Spawned cluster with pid ' + process.pid + '.');

	process.on('SIGHUP', function() {
		if (!sighupSent) {
			sighupSent = true;
			killAll('SIGHUP');
			setTimeout(function() {
				sighupSent = false;
			}, 30000);
		}
	});

	process.on('SIGUSR2', function() {
		util.log('Restart signal received, reloading instances');
		cluster.reload();
	});

	process.on('SIGTERM', function() {
		util.log('TERM signal received, shutting down instances');
		cluster.terminate();
	});

	/**
	 * Monitor the specified file for restart. If that file
	 * is modified, shut down the current process instance.
	 */
	if (fs.existsSync(restartFile)) {
		fs.watchFile(restartFile, function() {
			util.log('Restart signal received, reloading instances');
			cluster.reload();
		});
	} else {
		util.log('Restart file ' + restartFile + ' not found, not watching.', restartFile);
	}

}

(function main() {

	var argv = process.argv.slice(2);
	var filename = argv[0];

	if (argv.length == 0) {
		return usage();
	}

	if (/\.js$/.test(filename) == false) {
		filename += '.js';
	}

	if (filename[0] != '/') {
		filename = process.cwd() + '/' + filename;
	}
	filename = path.normalize(filename);

	if (!fs.existsSync(filename)) {
		return util.log('Cannot find ' + filename + ', aborting.');
	}

	startApp(filename);

}());