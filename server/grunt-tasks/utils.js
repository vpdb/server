"use strict";

var fs = require('fs');

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


	grunt.registerTask('sleep', function() {
		var done = this.async();
		setTimeout(done, 2000);
	});

};
