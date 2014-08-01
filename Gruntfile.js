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
	var configold = {

		execute: {
			target: {
				src: ['app.js']
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
				files: [ '.reload', 'client/code/**/*.js', 'client/views/**/*.jade' ],
				options: {
					spawn: false,
					livereload: grunt.option('no-reload') || process.env.NO_RELOAD ? false : true
				}
			},
			test: {
				files: ['.reload', 'test/**/*.js'],
				tasks: ['waitServer', 'mochaTest' ],
				options: { spawn: false }
			},
			coverage: {
				files:  [ '**/*.js' ],
				tasks:  [ 'express:dev' ],
				options: {
					nospawn: true
				}
			}
		},

		nodemon: {
			dev: {
				script: 'app.js',
				options: {
					cwd: __dirname,
					watch: [ 'server', 'gitinfo.json', 'app.js' ],
					callback: function (nodemon) {
						nodemon.on('log', function (event) {
							console.log(event.colour);
						});

						// refreshes browser when server restarts
						nodemon.on('restart', function () {
							// Delay before server listens on port
							setTimeout(function() {
								fs.writeFileSync('.reload', new Date());
							}, 1000);
						});
					}
				}
			},
			coverage: {
				script: 'test/coverage/instrument/app.js',
				options: {
					cwd: __dirname,
					watch: [ '.restart' ],
					callback: function (nodemon) {
						nodemon.on('log', function (event) {
							console.log(event.colour);
						});

						// refreshes browser when server restarts
						nodemon.on('restart', function () {
							// Delay before server listens on port
							setTimeout(function() {
								fs.writeFileSync('.reload', new Date());
							}, 1000);
						});
					}
				}
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
		},

		concurrent: {
			server: {
				tasks: [ 'nodemon:dev', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload' ],
				options: {
					logConcurrentOutput: true
				}
			},

			test: {
				tasks: [ 'nodemon:dev', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload', 'test-client' ],
				options: {
					logConcurrentOutput: true
				}
			},

			coverage: {
				tasks: [ 'test-server-coverage', 'test-client' ],
				options: {
					logConcurrentOutput: true
				}
			}
		}
	};

	var config = {

		clean: {
			build:      { src: [ cssRoot, jsRoot ] },
			styleguide: { src: ['styleguide/**/*.html'] },
			coverage:   { src: ['test/coverage/'] }
		},

		concurrent: {
			dev: {
				tasks: [ 'express-dev', 'watch:server', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload' ],
				options: { logConcurrentOutput: true }
			}
		},

		coveralls: {
			options: { force: false },
			api: { src: path.resolve(__dirname, 'test/coverage/lcov.info') }
		},

		cssmin: {
			minify: { expand: false, cwd: '.', dest: cssGlobal, ext: '.css', src: [
				'client/static/css/lib/*.css',
				'client/static/css/fonts.css',
				'client/static/css/hljs-pojoaque.css',
				cssRoot + '/*.css'
			] }
		},

		env: {
			dev: localEnv(grunt),
			test: localEnv(grunt, true),
			prod: { NODE_ENV: 'production', APP_SETTINGS: process.env.APP_SETTINGS ||  path.resolve(__dirname, 'server/config/settings.js'), PORT: process.env.PORT || 3000 }
		},

		express: {
			options: { output: 'Server listening at' },
			dev:     { options: { script: 'app.js', port: localEnv(grunt).PORT } },
			test:    { options: { script: 'app.js', port: localEnv(grunt, true).PORT } },
			prod:    { options: { script: 'app.js', background: false } }
		},

		gitsave: { output: 'gitinfo.json' },

		'istanbul-middleware': {
			options:  { url: 'http://127.0.0.1:' + localEnv(grunt, true).PORT + '/coverage' },
			download: { dest: 'test/coverage' },
			reset: { }
		},

		jade: {
			errors: {
				options: { data: {
					deployment: process.env.APP_NAME || 'staging',
					environment: process.env.NODE_ENV || 'development',
					jsFiles: assets.getJS(),
					cssFiles: assets.getCSS()
				} },
				files: [ { expand: true, cwd: 'client/views/errors', src: [ '*.jade' ], dest: htmlRoot, ext: '.html' } ]
			}
		},

		mkdir: {
			server:   { options: { mode: 504, create: [ cssRoot, jsRoot ] } },
			coverage: { options: { mode: 504, create: [ 'test/coverage' ] } }
		},

		mochaTest: {
			api: { options: { reporter: 'spec', clearRequireCache: true }, src: ['test/api/*.test.js'] }
		},

		stylus: {
			build: {
				options: { paths: [ 'styles' ], linenos: false, compress: false },
				files: [ { expand: true, cwd: 'client/styles', src: [ 'vpdb.styl' ], dest: cssRoot, ext: '.css' } ]
			}
		},

		uglify: {
			build: {
				options: { mangle: false, compress: false, beautify: false },
				files: [ { expand: false, cwd: '.', dest: jsGlobal,
					src: _.map(assets.js, function(js) {
						return path.resolve('client/code', js);
			}) }] }
		},

		waitServer: {
			test: { options: { url: 'http://localhost:' + localEnv(grunt, true).PORT } }
		},

		watch: {
			express:     { files: '.restart',                options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:dev' ] },
			coverage:    { files: '.restart',                options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:coverage' ] },
			server:      { files: 'server/**/*.js',          options: { spawn: false, debounceDelay: 100 }, tasks: [ 'restart' ] },
			branch:      { files: '.git/HEAD',               options: { spawn: false, debounceDelay: 0 },   tasks: [ 'git', 'restart' ] },
			stylesheets: { files: 'client/styles/**/*.styl', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'stylus', 'kss', 'reload' ] },
			styleguide:  { files: [ 'client/views/styleguide.jade', 'client/views/partials/styleguide-section.jade', 'doc/styleguide.md' ],
			               options: { spawn: false, debounceDelay: 100 }, tasks: [ 'kss', 'reload' ]
			},
			livereload:  { files: [ '.reload', 'client/code/**/*.js', 'client/views/**/*.jade' ],
			               options: { spawn: false, debounceDelay: 100, livereload: grunt.option('no-reload') || process.env.NO_RELOAD ? false : true }
			},
			test:        { files: [ '.reload', 'test/**/*.js'], options: { spawn: false, debounceDelay: 100 }, tasks: [ 'sleep', 'waitServer', 'mochaTest' ] }
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
	grunt.loadNpmTasks('grunt-coveralls');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-execute');
	grunt.loadNpmTasks('grunt-express-server');
	grunt.loadNpmTasks('grunt-gitinfo');
	grunt.loadNpmTasks('grunt-istanbul');
	grunt.loadNpmTasks('grunt-nodemon');
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-wait-server');

	grunt.loadTasks('./server/grunt-tasks');


	// working

	grunt.registerTask('build', 'What run on production before switching code.',
		[ 'clean:build', 'mkdir:server', 'stylus', 'cssmin', 'uglify', 'git', 'kssrebuild', 'jade' ]
	);
	grunt.registerTask('dev', [ 'build', 'concurrent:dev' ]);
	grunt.registerTask('serve', [ 'env:prod', 'express:prod' ]);
	grunt.registerTask('serve-test', [ 'env:test', 'express:test' ]);
	grunt.registerTask('express-dev', [ 'env:dev',  'express:dev', 'watch:express' ]);


	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask('kssrebuild', [ 'clean:styleguide', 'kss' ]);


	//grunt.registerTask('test', [ 'env:test', 'build', 'concurrent:coverage' ]);

	grunt.registerTask('test-client-coverage', [ 'restart', 'sleep', 'env:test', 'clean:coverage', 'mkdir:coverage', 'waitServer',
		'mochaTest', 'istanbul-middleware:download', 'coveralls:api' ]);

};

function localEnv(grunt, test) {

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
		env.COVERAGE = true;
		env.COVERALLS_SERVICE_NAME = 'Local Test Runner';
		// env.COVERALLS_REPO_TOKEN = '';
		env.HTTP_SCHEMA = 'http' + (settings && settings.vpdb.httpsEnabled ? 's' : '');
		env.AUTH_HEADER = settings ? settings.vpdb.authorizationHeader : 'Authorization';
	}

	return env;
}