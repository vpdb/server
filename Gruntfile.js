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
			build:      { src: [ cssRoot, jsRoot ] },
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
			ci: localEnv(grunt, true, true),
			prod: { NODE_ENV: 'production', APP_SETTINGS: process.env.APP_SETTINGS ||  path.resolve(__dirname, 'server/config/settings.js'), PORT: process.env.PORT || 3000 }
		},

		express: {
			options: { output: 'Server listening at' },
			dev:     { options: { script: 'app.js', port: localEnv(grunt).PORT } },
			test:    { options: { script: 'app.js', port: localEnv(grunt, true).PORT } },
			prod:    { options: { script: 'app.js', background: false } },
			ci:      { options: { script: 'app.js', background: false, port: localEnv(grunt, true).PORT } }
		},

		gitsave: { output: 'gitinfo.json' },

		'istanbul-middleware': {
			options:  { url: 'http://127.0.0.1:' + localEnv(grunt, true).PORT + '/_coverage' },
			download: { dest: 'test/coverage' },
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

		jshint: { options: { jshintrc: 'test/.jshintrc', ignores: [ 'test/coverage/**/*.js'] },
		          files: { src: [ 'server/**/*.js', 'test/**/*.js' ] },
		          gruntfile: { src: 'Gruntfile.js' }
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
			test:        { files: [ 'test/**/*.js'], options: { spawn: true, debounceDelay: 100, atBegin: true },
			             tasks:   [ 'clean:coverage', 'mkdir:coverage', 'waitServer', 'mochaTest', 'istanbul-middleware:download', 'restart', 'reload' ] }
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
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-wait-server');
	grunt.loadTasks('./server/grunt-tasks');


	// pre-compilation
	grunt.registerTask('build', 'What run on production before switching code.',
		[ 'clean:build', 'mkdir:server', 'stylus', 'cssmin', 'uglify', 'git', 'kssrebuild', 'jade' ]
	);
	// server tasks
	grunt.registerTask('dev', [ 'build', 'env:dev',  'jshint', 'concurrent:dev' ]);  // dev mode, watch everything
	grunt.registerTask('serve-test',   [ 'env:test', 'jshint', 'concurrent:test' ]); // test mode, watch only server
	grunt.registerTask('serve',        [ 'env:prod', 'express:prod' ]);              // prod, watch nothing

	// watchers
	grunt.registerTask('watch-dev',    [ 'express:dev',  'watch:express-dev' ]);
	grunt.registerTask('watch-test',   [ 'express:test', 'watch:express-test' ]);

	// assets
	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask('kssrebuild', [ 'clean:styleguide', 'kss' ]);

	// tests
	grunt.registerTask('test', [ 'env:test', 'watch:test' ]);

	// continuous integration
	grunt.registerTask('ci', [ 'concurrent:ci' ]);
	grunt.registerTask('ci-server', [ 'env:ci', 'express:ci' ]);
	grunt.registerTask('ci-client', [ 'env:ci', 'clean:coverage', 'mkdir:coverage', 'waitServer',
		'mochaTest', 'istanbul-middleware:download', 'coveralls:api', 'stop' ]);
};

function localEnv(grunt, test, ci) {

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
		env.COVERAGE = true;
		env.COVERALLS_SERVICE_NAME = ci ? 'Travis CI' : 'Local Test Runner';
		env.HTTP_SCHEMA = 'http' + (settings && settings.vpdb.httpsEnabled ? 's' : '');
		env.AUTH_HEADER = settings ? settings.vpdb.authorizationHeader : 'Authorization';
	}

	return env;
}