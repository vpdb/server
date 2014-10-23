"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');

module.exports = function(grunt) {

	setEnv(grunt);
	var config = require('./server/modules/settings').current;

	var writeable = require('./server/modules/writeable');
	var markdown = require('./server/config/marked');
	var assets = require('./server/modules/assets');
	var ctrl = require('./server/controllers/ctrl');

	var buildRoot = writeable.buildRoot;
	var devsiteRoot = writeable.devsiteRoot;
	var cssRoot = writeable.cssRoot;
	var jsRoot = writeable.jsRoot;
	var htmlRoot = writeable.htmlRoot;
	var cssGlobal = path.resolve(cssRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.js');
	var jsGlobalAnnotated = path.resolve(jsRoot, 'global.annotated.js');

	var viewParams = ctrl.viewParams(true);

	// configure the tasks
	var taskConfig = {

		config: {
			buildRoot: writeable.buildRoot,
			devsiteRoot: writeable.devsiteRoot,
			cssRoot: writeable.cssRoot,
			jsRoot: writeable.jsRoot,
			htmlRoot: writeable.htmlRoot,
			cssGlobal: path.resolve(cssRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.css'),
			jsGlobal: path.resolve(jsRoot, 'global_<%= gitinfo.local.branch.current.shortSHA %>.min.js'),
			jsGlobalAnnotated: path.resolve(jsRoot, 'global.annotated.js'),
			coverageRoot: path.resolve(__dirname, 'coverage')
		},

		clean: {
			build:      { src: [ buildRoot + '/*', "!.gitignore", "!img" ] },
			coverage:   { src: [ '<%= config.coverageRoot %>/**'] },
			devsite:    { src: [ devsiteRoot ] }
		},

		concurrent: {
			dev: {
				tasks: [ 'watch-dev', 'watch:server', 'watch:branch', 'watch:stylesheets', 'watch:livereload' ],
				options: { logConcurrentOutput: true, limit: 6 }
			},
			test: {
				tasks: [ 'watch-test', 'watch:server', 'watch:livereload' ],
				options: { logConcurrentOutput: true }
			},
			ci: {
				tasks: [ 'ci-server', 'ci-client' ],
				options: { logConcurrentOutput: true }
			},
			devsite: {
				tasks: [ 'watch:devsite', 'watch:stylesheets', 'watch:livereload', 'devsite-serve' ],
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
			},
			devsite: {
				files: [ { expand: true, cwd: buildRoot, src: [ '**', '!html/**' ], dest: devsiteRoot } ]
			}
		},

		coveralls: {
			options: { force: false },
			api: { src: '<%= config.coverageRoot %>/lcov.info' }
		},

		cssmin: {
			minify: { expand: false, cwd: '.', dest: cssGlobal, ext: '.css', src: _.pluck(assets.getCss(), 'src') }
		},

		'devsite-serve': { options: { root: devsiteRoot, port: 4000, runInBackground: false, map: {
			'/js': path.resolve(__dirname, 'client/app')
		}}},

		env: {
			dev: env(grunt, config),
			test: testEnv(grunt, config),
			prod: env(grunt, config, { NODE_ENV: 'production' })
		},

		express: {
			options: { output: 'Server listening at' },
			dev:     { options: { script: 'app.js', port: config.vpdb.webapp.port } },
			test:    { options: { script: 'app.js', port: config.vpdb.webapp.port } },
			prod:    { options: { script: 'app.js', background: false } },
			ci:      { options: { script: 'app.js', background: false, port: config.vpdb.webapp.port } }
		},

		gitsave: { dest: 'gitinfo.json' },

		'istanbul-middleware': {
			options:  { url: 'http://127.0.0.1:' + config.vpdb.webapp.port + '/_coverage' },
			download: { dest: '<%= config.coverageRoot %>' }
		},

		jade: {
			site: {
				options: { data: _.extend(viewParams, { environment: 'production', gitinfo: '<%= gitinfo %>' }) },
				files: [ { expand: true, cwd: 'client/app', src: [ '**/*.jade', '!layout.jade', '!**/devsite/**' ], dest: htmlRoot, ext: '.html' } ]
			}
		},

		jshint: { options: { jshintrc: 'test/.jshintrc', ignores: [ '<%= config.coverageRoot %>/**/*.js'] },
		          files: { src: [ 'server/**/*.js', 'test/**/*.js', '!server/grunt-tasks/**' ] },
		          gruntfile: { src: 'Gruntfile.js' }
		},

		metalsmith: {
			options: {
				clean: false,
				dest: 'devsite/html',
				src: 'doc',
				markdown: markdown
			}
		},

		mkdir: {
			server:   { options: { mode: 504, create: [ cssRoot, jsRoot ] } },
			coverage: { options: { mode: 504, create: [ '<%= config.coverageRoot %>' ] } },
			test:     { options: { mode: 504, create: [ config.vpdb.storage ] }},
			devsite:  { options: { mode: 504, create: [ devsiteRoot + '/html/styleguide' ] } }
		},

		mochaTest: {
			api: { options: { reporter: 'spec', clearRequireCache: true, timeout: 120000 }, src: [
				'test/api/*.test.js','test/storage/*.test.js'
			] }
		},

		mongodb: config.vpdb.db,

		ngAnnotate: {
			options: { singleQuotes: true },
			app: { files: [ { src: [ _.pluck(assets.getJs(), 'src') ], dest: jsGlobalAnnotated } ] }
		},

		protractor: {
			options: {
				keepAlive: true, // If false, the grunt process stops when the test fails.
				noColor: false, // If true, protractor will not use colors in its output.
				args: {
					// Arguments passed to the command
				}
			},
			all: {   // Grunt requires at least one target to run so you can simply put 'all: {}' here too.
				options: {
					configFile: "test/protractor.js", // Target-specific config file
					args: {} // Target-specific arguments
				}
			}
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
			test: { options: { url: 'http://127.0.0.1:' + config.vpdb.webapp.port, timeout: 30000 } }
		},

		watch: {

			// restart/reload watches
			'express-dev':     { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:dev' ] },
			'express-test':    { files: '.restart', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'express:test' ] },
			livereload:        { files: [ '.reload', 'client/app/**/*.js', 'client/app/**/*.jade' ],
			          options: { spawn: false, debounceDelay: 100, livereload: grunt.option('no-reload') ? false : true }
			},

			// server watches
			server:      { files: 'server/**/*.js', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'restart', 'reload' ] },
			branch:      { files: '.git/HEAD',      options: { spawn: false, debounceDelay: 0 },   tasks: [ 'git', 'restart' ] },

			// client watches
			stylesheets: { files: 'client/styles/**/*.styl', options: { spawn: false, debounceDelay: 100 }, tasks: [ 'stylus', 'kss', 'copy:devsite', 'reload' ] },
			devsite:     { files: [ 'client/app/devsite/**', 'doc/**' ],
			               options: { spawn: false, debounceDelay: 100 }, tasks: [ 'metalsmith', 'reload' ] },

			// test watch
			test: { files: [ 'test/api/**/*.js', 'test/modules/**/*.js' , 'test/storage/**/*.js' ], options: { spawn: true, debounceDelay: 100, atBegin: true },
			        tasks: [ 'mkdir:coverage', 'waitServer', 'mochaTest', 'istanbul-middleware:download', 'restart', 'reload' ] },
			protractor: { files: [ 'test/web/**/*.js', 'test/modules/**/*.js' ], options: { spawn: true, debounceDelay: 100, atBegin: true },
			              tasks: [ 'waitServer', 'protractor', 'restart', 'reload' ] }
		}
	};
	grunt.config.init(taskConfig);

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
	grunt.loadNpmTasks('grunt-protractor-runner');
	grunt.loadNpmTasks('grunt-wait-server');
	grunt.loadTasks('./server/grunt-tasks');

	// build
	grunt.registerTask('build', 'What run on production before switching code.',
		[ 'env:prod', 'build-all' ]
	);
	grunt.registerTask('build-all', [
			'git', 'clean:build', 'mkdir:server',                 // clean and create folder structure
			'copy:assets', 'copy:static',                         // copy static stuff
			'stylus', 'cssmin',                                   // render & minify css
			'client-config', 'ngAnnotate', 'uglify', 'jade',      // treat javascripts
			'copy:devsite', 'mkdir:devsite', 'kss', 'metalsmith'  // create devsite
		]
	);

	// server tasks
	grunt.registerTask('dev',        [ 'env:dev',                         'jshint',               'concurrent:dev' ]);  // dev mode, watch everything
	grunt.registerTask('serve-test', [ 'env:test', 'build-all', 'dropdb', 'jshint', 'mkdir:test', 'concurrent:test' ]); // test mode, watch only server
	grunt.registerTask('srv-tst',    [ 'env:test', 'dropdb', 'concurrent:test' ]);
	grunt.registerTask('serve',      [ 'env:prod', 'express:prod' ]);                                                   // prod, watch nothing

	// watchers
	grunt.registerTask('watch-dev',  [ 'express:dev',  'watch:express-dev' ]);
	grunt.registerTask('watch-test', [ 'express:test', 'watch:express-test' ]);

	// generate
	grunt.registerTask('git', [ 'gitinfo', 'gitsave']);
	grunt.registerTask('devsite', [ 'env:dev', /*'clean:devsite',*/ 'copy:devsite', 'mkdir:devsite', 'kss', 'metalsmith', 'concurrent:devsite' ]);

	// tests
	grunt.registerTask('test', [ 'env:test', 'watch:test' ]);
	grunt.registerTask('test-web', [ 'env:test', 'watch:protractor' ]);

	// continuous integration
	grunt.registerTask('ci', [ 'concurrent:ci' ]);
	grunt.registerTask('ci-server', [ 'env:test', 'mkdir:test', 'express:ci' ]);
	grunt.registerTask('ci-client', [ 'env:test', 'clean:coverage', 'mkdir:coverage', 'waitServer',
		'mochaTest', 'istanbul-middleware:download', 'stop' ]);
};


/**
 * Sets APP_SETTINGS and APP_TESTING depending on which task was executed. This
 * guarantees that grunt tasks can be setup with values from settings.js BEFORE
 * any task is launched.
 *
 * @param grunt
 */
function setEnv(grunt) {
	var settingsPath;
	var cmdLineTask = process.argv[2];

	// check for tasks that need test environment
	if (_.contains([ 'serve-test', 'srv-tst', 'test', 'ci', 'ci-server', 'ci-client' ], cmdLineTask)) {
		settingsPath = path.resolve(__dirname, 'server/config/settings-test.js');
		process.env.APP_TESTING = true;
		grunt.log.writeln('Test environment enabled.');
	} else {
		settingsPath = path.resolve(__dirname, grunt.option('config') || process.env.APP_SETTINGS || (fs.existsSync('server/config/settings.js') ? 'server/config/settings.js' : 'server/config/settings-dist.js' ));
		process.env.APP_TESTING = false;
	}
	if (!fs.existsSync(settingsPath)) {
		throw new Error('Cannot find any settings at ' + settingsPath + '. Please set `APP_SETTINGS` correctly or provide it via `--config=<path-to-settings>`.');
	}
	process.env.APP_SETTINGS = settingsPath;
	grunt.log.writeln('Using settings at "%s"...', settingsPath);
}

function env(grunt, config, more) {
	return _.extend({
		PORT: grunt.option('port') || process.env.PORT || config.vpdb.webapp.port || 3000,
		HTTP_SCHEME: config.vpdb.webapp.protocol,
		AUTH_HEADER: config.vpdb.authorizationHeader
	}, more || {});
}

function testEnv(grunt, config, more) {
	return _.extend(env(grunt, config, more), {
		COVERAGE_ENABLED: true,
		COVERALLS_SERVICE_NAME: process.env.BUILDER || 'Local Test Runner'
	});
}
