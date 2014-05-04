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
			stylesheets: {
				files: 'client/css/*.styl',
				tasks: [ 'stylus' ]
			}
		}
	};

	grunt.initConfig(config);

	// load the tasks
	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// define the tasks
	grunt.registerTask(
		'build',
		'Compiles all of the assets to the cache directory.',
		[ 'clean', 'mkdir', 'stylus', 'cssmin', 'uglify' ]
	);

};