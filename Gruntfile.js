var _ = require('underscore');
var path = require('path');
var writeable = require('./server/modules/writeable');
var assets = require('./server/config/assets');

module.exports = function(grunt) {

	var cacheRoot = writeable.cacheRoot;
	var cssRoot = path.resolve(cacheRoot, 'css/');
	var jsRoot = path.resolve(cacheRoot, 'js/');
	var cssGlobal = path.resolve(cssRoot, 'global.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global.min.js');

	// configure the tasks
	var config = {

		clean: {
			build: {
				src: [ cssRoot, jsRoot ]
			}
		},

		mkdir: {
			all: {
				options: {
					mode: 0770,
					create: [ cssRoot, jsRoot ]
				}
			}
		},

		stylus: {
			build: {
				options: {
					linenos: false,
					compress: false
				},
				files: [{
					expand: true,
					cwd: 'client/css',
					src: [ '*.styl' ],
					dest: cssRoot,
					ext: '.css'
				}]
			}
		},

		cssmin: {
			minify: {
				expand: false,
				cwd: '.',
				src: [ 'client/static/css/lib/*.css', 'client/static/css/fonts.css', cssRoot + '/*.css' ],
				dest: cssGlobal,
				ext: '.css'
			}
		},

		uglify: {
			build: {
				options: {
					mangle: false,
					compress: false,
					beautify: false
				},
				files: [{
					expand: false,
					cwd: '.',
					src: _.map(assets.js, function(js) {
						return path.resolve('client/code', js);
					}),
					dest: jsGlobal
				}]
			}
		},

		watch: {
			branch: {
				files: '.git/HEAD',
				tasks: [ 'git' ]
			},
			stylesheets: {
				files: 'client/css/*.styl',
				tasks: [ 'stylus' ],
				options: {
					livereload: true
				}
			},
			server: {
				files: ['.rebooted', 'client/code/**/*.js', 'client/views/**/*.jade'],
				options: {
					livereload: true
				}
			}
		},

		gitsave: {
			output: 'gitinfo.json'
		},

		concurrent: {
			dev: {
				tasks: ['nodemon', 'watch'],
				options: {
					logConcurrentOutput: true
				}
			}
		},

		nodemon: {
			dev: {
				script: 'app.js',
				options: {
					cwd: __dirname,
					ignore: ['node_modules/**'],
					watch: [ 'server', 'gitinfo.json' ],
					callback: function (nodemon) {
						nodemon.on('log', function (event) {
							console.log(event.colour);
						});

						// refreshes browser when server reboots
						nodemon.on('restart', function () {
							// Delay before server listens on port
							setTimeout(function() {
								require('fs').writeFileSync('.rebooted', new Date());
							}, 1000);
						});
					}
				}
			}
		}

	};

	grunt.config.init(config);

	// load the tasks
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-nodemon');
	grunt.loadNpmTasks('grunt-gitinfo');
	grunt.loadNpmTasks('grunt-concurrent');

	// define the tasks
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
	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask(
		'build',
		'Compiles all of the assets to the cache directory.',
		[ 'clean', 'mkdir', 'stylus', 'cssmin', 'uglify', 'git' ]
	);
	grunt.registerTask('dev', [ 'build', 'concurrent' ]);
};