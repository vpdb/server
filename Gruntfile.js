"use strict";

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var writeable = require('./server/modules/writeable');
var assets = require('./server/config/assets');

module.exports = function(grunt) {

	var cacheRoot = writeable.cacheRoot;
	var cssRoot = path.resolve(cacheRoot, 'css');
	var jsRoot = path.resolve(cacheRoot, 'js');
	var htmlRoot = path.resolve(cacheRoot, 'html/');
	var cssGlobal = path.resolve(cssRoot, 'global.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global.min.js');

	var devConfig = settings(grunt, false);
	var testConfig = settings(grunt, true);

	// configure the tasks
	var config = {

		clean: {
			build:      { src: [ cacheRoot + '/*', "!.gitignore", "!img" ] },
			styleguide: { src: ['styleguide/**/*.html'] },
			coverage:   { src: ['test/coverage/**'] }
		},

		concurrent: {
			dev: {
				tasks: [ 'watch-dev', 'watch:server', 'watch:branch', 'watch:stylesheets', 'watch:styleguide', 'watch:livereload' ],
				options: { logConcurrentOutput: true, limit: 6 }
			},
			test: {
				tasks: [ 'watch-test', 'watch:server', 'watch:livereload' ],
				options: { logConcurrentOutput: true }
			},
			ci: {
				tasks: [ 'ci-server', 'ci-client' ],
				options: { logConcurrentOutput: true }
			}
		},

		copy: {
			assets: {
				files: _.map(assets.vendor(), function(dep) {
					return { expand: false, nonull: true, src: dep.src, dest: dep.dest };
				})
			},
			'static': {
				files: [ { expand: true, cwd: 'client/static/', src: [ '**' ], dest: cacheRoot } ]
			}

		},

		coveralls: {
			options: { force: false },
			api: { src: path.resolve(__dirname, 'test/coverage/lcov.info') }
		},

		cssmin: {
			minify: { expand: false, cwd: '.', dest: cssGlobal, ext: '.css', src: _.pluck(assets.getCss(), 'src') }
		},

		env: {
			dev: localEnv(grunt, devConfig),
			test: localEnv(grunt, testConfig),
			ci: localEnv(grunt, testConfig),
			prod: { NODE_ENV: 'production', APP_SETTINGS: process.env.APP_SETTINGS ||  path.resolve(__dirname, 'server/config/settings.js'), PORT: process.env.PORT || 3000 }
		},

		express: {
			options: { output: 'Server listening at' },
			dev:     { options: { script: 'app.js', port: localEnv(grunt, devConfig).PORT } },
			test:    { options: { script: 'app.js', port: localEnv(grunt, testConfig).PORT } },
			prod:    { options: { script: 'app.js', background: false } },
			ci:      { options: { script: 'app.js', background: false, port: localEnv(grunt, testConfig).PORT } }
		},

		gitsave: { output: 'gitinfo.json' },

		'istanbul-middleware': {
			options:  { url: 'http://127.0.0.1:' + localEnv(grunt, testConfig).PORT + '/_coverage' },
			download: { dest: 'test/coverage' }
		},

		jade: {
			errors: {
				options: { data: {
					deployment: process.env.APP_NAME || 'staging',
					environment: process.env.NODE_ENV || 'development',
					jsFiles: assets.getJs(),
					cssFiles: assets.getCss()
				} },
				files: [ { expand: true, cwd: 'client/views/errors', src: [ '*.jade' ], dest: htmlRoot, ext: '.html' } ]
			}
		},

		jshint: { options: { jshintrc: 'test/.jshintrc', ignores: [ 'test/coverage/**/*.js'] },
		          files: { src: [ 'server/**/*.js', 'test/**/*.js' ] },
		          gruntfile: { src: 'Gruntfile.js' }
		},

		mkdir: {
			server:   { options: { mode: 504, create: [ cssRoot, jsRoot ] } },
			coverage: { options: { mode: 504, create: [ 'test/coverage' ] } },
			test:     { options: { mode: 504, create: [ testConfig.vpdb.storage ] }}
		},

		mochaTest: {
			api: { options: { reporter: 'spec', clearRequireCache: true, timeout: 30000 }, src: [
				'test/api/*.test.js','test/web/*.test.js',
			] }
		},

		mongodb: testConfig.vpdb.db,

		stylus: {
			build: {
				options: { paths: [ 'styles' ], linenos: false, compress: false },
				files: [ { expand: true, cwd: 'client/styles', src: [ 'vpdb.styl' ], dest: cssRoot, ext: '.css' } ]
			}
		},

		uglify: {
			build: {
				options: { mangle: false, compress: false, beautify: false, sourceMap: true },
				files: [ { expand: false, cwd: '.', dest: jsGlobal, src: _.pluck(assets.getJs(), 'src') }]
			}
		},

		waitServer: {
			test: { options: { url: 'http://127.0.0.1:' + localEnv(grunt, testConfig).PORT } }
		},

		watch: {

			// restart/reload watches
			'express-dev':     { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:dev' ] },
			'express-test':    { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:test' ] },
			livereload:        { files: [ '.reload', 'client/code/**/*.js', 'client/views/**/*.jade' ],
			          options: { spawn: false, debounceDelay: 100, livereload: grunt.option('no-reload') ? false : true }
			},

			// server watches
			server:      { files: 'server/**/*.js', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'restart', 'reload' ] },
			branch:      { files: '.git/HEAD',      options: { spawn: false, debounceDelay: 0 },   tasks: [ 'git', 'restart' ] },

			// client watches
			stylesheets: { files: 'client/styles/**/*.styl', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'stylus', 'kss', 'reload' ] },
			styleguide:  { files: [ 'client/views/styleguide.jade', 'client/views/partials/styleguide-section.jade', 'doc/styleguide.md' ],
			               options: { spawn: false, debounceDelay: 100 }, tasks: [ 'kss', 'reload' ] },

			// test watch
			test: { files: [ 'test/api/**/*.js', 'test/modules/**/*.js' ,'test/web/**/*.js' ], options: { spawn: true, debounceDelay: 100, atBegin: true },
			      tasks:   [ 'mkdir:coverage', 'waitServer', 'mochaTest', 'istanbul-middleware:download'/*, 'restart', 'reload' */] }
		}
	};
	grunt.config.init(config);

	// load the tasks
	grunt.loadNpmTasks('grunt-bower-task');
	grunt.loadNpmTasks('grunt-concurrent');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
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
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-wait-server');
	grunt.loadTasks('./server/grunt-tasks');

	// pre-compilation
	grunt.registerTask('build', 'What run on production before switching code.',
		[ 'clean:build', 'mkdir:server', 'copy:assets', 'copy:static', 'stylus', 'cssmin', 'uglify', 'git', 'kssrebuild', 'jade' ]
	);
	// server tasksgut
	grunt.registerTask('dev', [ 'build', 'env:dev',            'jshint',               'concurrent:dev' ]);  // dev mode, watch everything
	grunt.registerTask('serve-test',   [ 'env:test', 'dropdb', 'jshint', 'mkdir:test', 'concurrent:test' ]); // test mode, watch only server
	grunt.registerTask('serve',        [ 'env:prod', 'express:prod' ]);                                      // prod, watch nothing

	// watchers
	grunt.registerTask('watch-dev',    [ 'express:dev',  'watch:express-dev' ]);
	grunt.registerTask('watch-test',   [ 'express:test', 'watch:express-test' ]);

	// generate
	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask('kssrebuild', [ 'clean:styleguide', 'kss' ]);

	// tests
	grunt.registerTask('test', [ 'env:test', 'watch:test' ]);

	// continuous integration
	grunt.registerTask('ci', [ 'concurrent:ci' ]);
	grunt.registerTask('ci-server', [ 'env:ci', 'mkdir:test', 'express:ci' ]);
	grunt.registerTask('ci-client', [ 'env:ci', 'clean:coverage', 'mkdir:coverage', 'waitServer',
		'mochaTest', 'istanbul-middleware:download', 'coveralls:api', 'stop' ]);
};

function localEnv(grunt, settings) {

	var env = {
		APP_SETTINGS: settings.settingsPath,
		PORT: grunt.option('port') || process.env.PORT || settings.vpdb.port || 3000
	};

	if (settings.settingsTestmode) {
		env.COVERAGE = true;
		env.COVERALLS_SERVICE_NAME = process.env.BUILDER || 'Local Test Runner';
		env.HTTP_SCHEMA = 'http' + (settings.vpdb.httpsEnabled ? 's' : '');
		env.AUTH_HEADER = settings.vpdb.authorizationHeader;
	}
	return env;
}

function settings(grunt, forTest) {
	var settingsPath;
	if (forTest) {
		settingsPath = path.resolve(__dirname, 'server/config/settings-test.js');
	} else {
		settingsPath = path.resolve(__dirname, grunt.option('config') || process.env.APP_SETTINGS || (fs.existsSync('server/config/settings.js') ? 'server/config/settings.js' : 'server/config/settings-dist.js' ));
	}
	if (!fs.existsSync(settingsPath)) {
		throw new Error('Cannot find any settings at ' + settingsPath + '. Please set `APP_SETTINGS` correctly or provide it via `--config=<path-to-settings>`.');
	}
	var s = require(settingsPath);
	s.settingsPath = settingsPath;
	s.settingsTestmode = forTest ? true : false;

	return s;
}