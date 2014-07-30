"use strict";

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var writeable = require('./server/modules/writeable');
var assets = require('./server/config/assets');

module.exports = function(grunt) {

	var cacheRoot = writeable.cacheRoot;
	var cssRoot = path.resolve(cacheRoot, 'css/');
	var jsRoot = path.resolve(cacheRoot, 'js/');
	var htmlRoot = path.resolve(cacheRoot, 'html/');
	var cssGlobal = path.resolve(cssRoot, 'global.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global.min.js');

	// configure the tasks
	var config = {

		clean: {
			build: {
				src: [ cssRoot, jsRoot ]
			},
			styleguide: {
				src: [ 'styleguide/**/*.html']
			}
		},

		execute: {
			target: {
				src: ['app.js']
			}
		},

		mkdir: {
			all: {
				options: {
					mode: 504, // 0770,
					create: [ cssRoot, jsRoot ]
				}
			}
		},

		stylus: {
			build: {
				options: {
					paths: ['styles'],
					linenos: false,
					compress: false
				},
				files: [{
					expand: true,
					cwd: 'client/styles',
					src: [ 'vpdb.styl' ],
					dest: cssRoot,
					ext: '.css'
				}]
			}
		},

		jade: {
			errors: {
				options: {
					data: {
						deployment: process.env.APP_NAME || 'staging',
						environment: process.env.NODE_ENV || 'development',
						jsFiles: assets.getJS(),
						cssFiles: assets.getCSS()
					}
				},
				files: [{
					expand: true,
					cwd: 'client/views/errors',
					src: [ '*.jade' ],
					dest: htmlRoot,
					ext: '.html'
				}]
			}
		},

		cssmin: {
			minify: {
				expand: false,
				cwd: '.',
				src: [
					'client/static/css/lib/*.css',
					'client/static/css/fonts.css',
					'client/static/css/hljs-pojoaque.css',
					cssRoot + '/*.css'
				],
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
				tasks: [ 'git' ],
				options: { spawn: false }
			},
			stylesheets: {
				files: 'client/styles/**/*.styl',
				tasks: [ 'stylus', 'kss', 'reload' ],
				options: { spawn: false }
			},
			styleguide: {
				files: [
					'client/views/styleguide.jade',
					'client/views/partials/styleguide-section.jade',
					'doc/styleguide.md'
				],
				tasks: [ 'kss' ],
				options: { spawn: false }
			},
			livereload: {
				files: ['.rebooted', '.reload', 'client/code/**/*.js', 'client/views/**/*.jade' ],
				options: {
					spawn: false,
					livereload: grunt.option('no-reload') || process.env.NO_RELOAD ? false : true
				}
			},
			test: {
				files: ['.rebooted', 'test/**/*.js'],
				tasks: ['waitServer', 'mochaTest'],
				options: { spawn: false }
			}
		},

		gitsave: {
			output: 'gitinfo.json'
		},

		concurrent: {
			server: {
				tasks: [ 'nodemon', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload' ],
				options: {
					logConcurrentOutput: true
				}
			},

			test: {
				tasks: [ 'nodemon', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload', 'test-client'],
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
								fs.writeFileSync('.rebooted', new Date());
							}, 1000);
						});
					}
				}
			}
		},

		env: {
			dev: envParams(grunt),
			test: envParams(grunt, true),
			testClient: envParams(grunt, true, true)
		},

		waitServer: {
			server: {
				options: {
					url: 'http://localhost:' + envParams(grunt, true).PORT
				}
			}
		},

		mochaTest: {
			api: {
				options: {
					reporter: 'spec',
					clearRequireCache: true
				},
				src: ['test/api/*.test.js']
			}
		},

		jshint: {
			options: {
				jshintrc: 'test/.jshintrc',
				ignores: [ ]
			},
			files: {
				src: [ 'server/**/*.js', 'test/**/*.js' ]
			},
			gruntfile: {
				src: 'Gruntfile.js'
			}
		}
	};

	grunt.config.init(config);

	// load the tasks
	grunt.loadNpmTasks('grunt-concurrent');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-jade');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-execute');
	grunt.loadNpmTasks('grunt-gitinfo');
	grunt.loadNpmTasks('grunt-nodemon');
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-wait-server');

	grunt.loadTasks('./server/grunt-tasks');

	// tasks
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

	grunt.registerTask('kssrebuild', [ 'clean:styleguide', 'kss']);
	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask(
		'build',
		'Compiles all of the assets to the cache directory.',
		[ 'clean:build', 'mkdir', 'stylus', 'cssmin', 'uglify', 'git', 'kssrebuild', 'jade' ]
	);
	grunt.registerTask('serve', [ 'env:dev', 'execute' ]);
	grunt.registerTask('dev', [ 'env:dev', 'build', 'concurrent:server' ]);
	grunt.registerTask('test', [ 'env:test', 'build', 'concurrent:test' ]);
	grunt.registerTask('test-server', [ 'env:test', 'concurrent:server' ]);
	grunt.registerTask('test-client', [ 'env:testClient', 'waitServer', 'mochaTest', 'watch:test' ]);
};

function envParams(grunt, test, testClient) {

	var defaultPath = test ? 'server/config/settings-test.js' : 'server/config/settings.js';
	var settingsPath = path.resolve(__dirname, grunt.option('config') ? grunt.option('config') : defaultPath);
	if (!fs.existsSync(settingsPath)) {
		return {};
	}
	var settings = require(settingsPath);

	var env = {
		APP_SETTINGS: settingsPath,
		PORT: grunt.option('port') || process.env.PORT || settings.vpdb.port || 3000
	};

	if (test) {
		env.NO_RELOAD = true;
	}

	if (testClient) {
		env.HTTP_SCHEMA = 'http' + (settings && settings.vpdb.httpsEnabled ? 's' : '');
		env.AUTH_HEADER = settings ? settings.vpdb.authorizationHeader : 'Authorization';
	}

	return env;
}