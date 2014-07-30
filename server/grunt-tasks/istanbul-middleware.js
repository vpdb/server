"use strict";

var fs = require('fs');
var request = require('request');
var path = require('path');
var Zip = require('adm-zip');

module.exports = function(grunt) {


	grunt.registerMultiTask('istanbul-middleware', function() {

		var done = this.async();
		var options = this.options();

		if (!options.url) {
			grunt.log.error('URL must be given for istanbul-middleware.');
			return done(false);
		}

		switch (this.target) {
			case 'download':
				var dest = this.data.dest;
				var baseDir = path.resolve(__dirname, '../..') + '\\';
				var zipfile = path.resolve(baseDir, dest, 'coverage.zip');
				var extractTo = path.resolve(baseDir, dest);
				grunt.log.writeln('Downloading coverage zip file from %s', options.url + '/download');
				grunt.log.writeln('Base dir =  %s', baseDir);

				request.get(options.url + '/download')
					.pipe(fs.createWriteStream(zipfile))
					.on('close', function() {
						grunt.log.writeln('Extracting zip file to %s', extractTo);
						var zip = new Zip(zipfile);
						zip.extractAllTo(extractTo, true);

						var lcovinfo = fs.readFileSync(extractTo + '/lcov.info');
						lcovinfo = replaceAll(lcovinfo.toString(), baseDir, '');
						lcovinfo = replaceAll(lcovinfo, '\\', '/');
						fs.writeFileSync(extractTo + '/lcov.info', lcovinfo);
						done();
					})
					.on('error', done);
				break;
			case 'reset':
				request.post(options.url + '/reset', done);
				break;
		}

	});

};

function escapeRegExp(string) {
	return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(string, find, replace) {
	return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}