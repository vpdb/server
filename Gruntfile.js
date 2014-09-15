"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var writeable = require('./server/modules/writeable');
var assets = require('./server/modules/assets');
var ctrl = require('./server/controllers/ctrl');

module.exports = function(grunt) {

	var buildRoot = writeable.buildRoot;
	var cssRoot = writeable.cssRoot;
	var jsRoot = writeable.jsRoot;
	var htmlRoot = writeable.htmlRoot;
	var cssGlobal = path.resolve(cssRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.js');
	var jsGlobalAnnotated = path.resolve(jsRoot, 'global.annotated.js');

	var devConfig = settings(grunt, false);
	var testConfig = settings(grunt, true);

	var viewParams = ctrl.viewParams(devConfig, true);

	// configure the tasks
	var config = {

		clean: {
			build:      { src: [ buildRoot + '/*', "!.gitignore", "!img" ] },
			styleguide: { src: [ buildRoot + '/styleguide/**/*.html'] },
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
				files: [ { expand: true, cwd: 'client/static/', src: [ '**' ], dest: buildRoot } ]
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
			prod: { NODE_ENV: 'production', APP_SETTINGS: process.env.APP_SETTINGS || path.resolve(__dirname, 'server/config/settings.js'), PORT: process.env.PORT || 3000 }
		},

		express: {
			options: { output: 'Server listening at' },
			dev:     { options: { script: 'app.js', port: localEnv(grunt, devConfig).PORT } },
			test:    { options: { script: 'app.js', port: localEnv(grunt, testConfig).PORT } },
			prod:    { options: { script: 'app.js', background: false } },
			ci:      { options: { script: 'app.js', background: false, port: localEnv(grunt, testConfig).PORT } }
		},

		gitsave: { dest: 'gitinfo.json' },

		'istanbul-middleware': {
			options:  { url: 'http://127.0.0.1:' + localEnv(grunt, testConfig).PORT + '/_coverage' },
			download: { dest: 'test/coverage' }
		},

		jade: {
			site: {
				options: { data: _.extend(viewParams, { environment: 'production', gitinfo: '<%= gitinfo %>' }) },
				files: [ { expand: true, cwd: 'client/views', src: [ '**/*.jade', '!layout.jade', '!**/styleguide*' ], dest: htmlRoot, ext: '.html' } ]
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
			api: { options: { reporter: 'spec', clearRequireCache: true, timeout: 60000 }, src: [
				'test/api/*.test.js','test/web/*.test.js'
			] }
		},

		mongodb: testConfig.vpdb.db,

		ngAnnotate: {
			options: { singleQuotes: true },
			app: { files: [ { src: [ _.pluck(assets.getJs(), 'src') ], dest: jsGlobalAnnotated } ] }
		},

		stylus: {
			build: {
				options: { paths: [ 'styles' ], linenos: false, compress: false, sourcemap: { sourceRoot: '/css' } },
				files: [ { expand: true, cwd: 'client/styles', src: [ 'vpdb.styl' ], dest: cssRoot, ext: '.css' } ]
			}
		},

		uglify: {
			build: {
				options: { mangle: true, compress: true, beautify: false, sourceMap: true, sourceMapIncludeSources: false },
				files: [ { expand: false, cwd: '.', dest: jsGlobal, src: jsGlobalAnnotated }]
			}
		},

		waitServer: {
			test: { options: { url: 'http://127.0.0.1:' + localEnv(grunt, testConfig).PORT, timeout: 30000 } }
		},

		watch: {

			// restart/reload watches
			'express-dev':     { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:dev' ] },
			'express-test':    { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:test' ] },
			livereload:        { files: [ '.reload', 'client/app/**/*.js', 'client/views/**/*.jade' ],
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
			      tasks:   [ 'mkdir:coverage', 'waitServer', 'mochaTest', 'istanbul-middleware:download', 'restart', 'reload' ] }
		}
	};
	grunt.config.init(config);

	// load the tasks
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
	grunt.loadNpmTasks('grunt-express-server');
	grunt.loadNpmTasks('grunt-gitinfo');
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-ng-annotate');
	grunt.loadNpmTasks('grunt-wait-server');
	grunt.loadTasks('./server/grunt-tasks');

	// build
	grunt.registerTask('build', 'What run on production before switching code.',
		[ 'git', 'env:prod', 'clean:build', 'mkdir:server', 'copy:assets', 'copy:static', 'stylus', 'cssmin', 'ngAnnotate', 'uglify', 'kssrebuild', 'jade' ]
	);
	// server tasksgut
	grunt.registerTask('dev', [          'env:dev',            'jshint',               'concurrent:dev' ]);  // dev mode, watch everything
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