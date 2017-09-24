/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
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
		grunt.file.write(gitsave.dest, JSON.stringify(gitinfo, null, '\t'));
		grunt.log.writeln('Gitinfo written to %s.', gitsave.dest);
	});

	grunt.registerTask('client-config', function() {
		var settings = require('../modules/settings');
		var configPath = path.resolve(grunt.config.get('config.jsRoot'), settings.clientConfigName());
		grunt.log.writeln('Writing client config to "%s"...', configPath);
		fs.writeFileSync(configPath, '// our only namespace raping\nvar vpdbConfig = ' + util.inspect(settings.clientConfig(), { depth: null }) + ';');
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
		grunt.log.writeln('Killing off server at %s', url);
		request.post(url, done);
	});

	grunt.registerTask('sleep', function() {
		var done = this.async();
		setTimeout(done, 2000);
	});

	grunt.registerTask('dropdb', 'drop the database', function() {
		if (!process.env.APP_TESTING) {
			throw new Error('Will not drop database if env APP_TESTING is not set.');
		}
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
				mongoose.connection.close(() => {
					console.log('Flushing Redis...');
					var redis = require('redis').createClient(grunt.config.get('redis').port, grunt.config.get('redis').host, { no_ready_check: true });
					redis.select(grunt.config.get('redis').db);
					redis.on('error', console.error.bind(console));
					redis.flushall(() => {
						console.log('Redis flushed!');
						done();
					});
				});
			});
		});

	});

};
