/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict";

var fs = require('fs');
var request = require('request');

module.exports = function(grunt) {

	grunt.registerTask('gitsave', function() {

		grunt.task.requires('gitinfo');

		var gitinfo = grunt.config.get('gitinfo');
		var gitsave = grunt.config.get('gitsave');

		// strip unnecessary quotes from author and time
		gitinfo.local.branch.current.lastCommitAuthor = gitinfo.local.branch.current.lastCommitAuthor.replace(/"/g, '');
		gitinfo.local.branch.current.lastCommitTime = gitinfo.local.branch.current.lastCommitTime.replace(/"/g, '');

		// dump to disk
		grunt.file.write(gitsave.output, JSON.stringify(gitinfo, null, "\t"));
		grunt.log.writeln("Gitinfo written to %s.", gitsave.output);
	});


	grunt.registerTask('reload', function() {
		fs.writeFileSync('.reload', new Date());
	});


	grunt.registerTask('restart', function() {
		fs.writeFileSync('.restart', new Date());
	});

	grunt.registerTask('stop', function() {
		var done = this.async();
		var url = 'http://127.0.0.1:' + process.env.PORT + '/kill';
		grunt.log.writeln("Killing off server at %s", url);
		request.post(url, done);
	});


	grunt.registerTask('sleep', function() {
		var done = this.async();
		setTimeout(done, 2000);
	});


	grunt.registerTask('dropdb', 'drop the database', function() {
		var mongoose = require('mongoose');
		var done = this.async();
		mongoose.connect(grunt.config.get('mongodb'), { server: { socketOptions: { keepAlive: 1 } } });
		mongoose.connection.on('open', function () {
			mongoose.connection.db.dropDatabase(function(err) {
				if (err) {
					console.log(err);
				} else {
					console.log('Successfully dropped db');
				}
				mongoose.connection.close(done);
			});
		});
	});

};
