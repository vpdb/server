var path = require('path');

module.exports = function(grunt) {

	var cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.resolve(__dirname, "cache");
	var cssRoot = path.resolve(cacheRoot, 'css/');
	var jsRoot = path.resolve(cacheRoot, 'js/');
	var cssGlobal = path.resolve(cssRoot, 'global.min.css');
	var jsGlobal = path.resolve(jsRoot, 'global.min.js');

	// configure the tasks
	grunt.initConfig({

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
					linenos: true,
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
					mangle: false
				},
				files: [{
					expand: false,
					cwd: '.',
					src: [
						'client/code/lib/jquery-2.1.0.js',
						'client/code/lib/angular-1.3.0-beta.3/angular.js',
						'client/code/lib/angular-1.3.0-beta.3/angular-route.js',
						'client/code/lib/angular-1.3.0-beta.3/angular-animate.js',
						'client/code/lib/angular-1.3.0-beta.3/angular-sanitize.js',
						'client/code/lib/angulartics-0.14.15/angulartics.js',
						'client/code/lib/angulartics-0.14.15/angulartics-ga.js',
						'client/code/lib/angulartics-0.14.15/angulartics-ga-cordova.js',
						'client/code/lib/ui-bootstrap-tpls-0.10.0.js',
						'client/code/lib/underscore-1.6.0.js',
						'client/code/lib/showdown.js',
						'client/code/lib/jquery.magnific-popup-0.9.9.js',
						'client/code/lib/jquery.nanoscroller-0.8.0.js',
						'client/code/lib/jquery.waitforimages-1.5.0.js',
						'client/code/lib/angular.scrollable-0.2.0.js',
						'client/code/app.js',
						'client/code/services.js',
						'client/code/controllers.js',
						'client/code/filters.js',
						'client/code/controller/*.js',
						'client/code/service/*.js',
						'client/code/directive/*.js'
					],
					dest: jsGlobal
				}]
			}
		}
	});

	// load the tasks
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	// define the tasks
	grunt.registerTask(
		'build',
		'Compiles all of the assets and copies the files to the build directory.',
		[ 'clean', 'mkdir', 'stylus', 'cssmin', 'uglify' ]
	);
};