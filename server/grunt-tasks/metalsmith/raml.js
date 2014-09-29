/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict";

var _ = require('lodash');
var jade = require('jade');
var async = require('async');
var debug = require('debug')('metalsmith-raml');
var marked = require('marked');
var raml2obj = require('raml2obj');
var relative = require('path').relative;
var normalize = require('path').normalize;


module.exports = function(opts) {

	opts = opts || {};
	opts.src = opts.src || 'src';
	opts.files = opts.files || {};
	opts.template = opts.template || 'template.jade';

	// we need a file-based dictionary, so convert the name-based one.
	var configuredFiles = {};
	_.each(opts.files || {}, function(value, key) {
		configuredFiles[normalize(value.src)] = { dest: value.dest, name: key };
	});

	if (opts.markdown) {
		marked.setOptions(opts.markdown);
	}

	return function(files, metalsmith, done) {

		var filepath;
		var srcFiles = {};

		// get raml files to render
		for (filepath in files) {
			if (files.hasOwnProperty(filepath)) {
				if (configuredFiles[filepath]) {
					srcFiles[filepath] = configuredFiles[filepath];
				}
			}
		}

		var metadata = metalsmith.metadata();

		// for each  api
		async.each(_.keys(srcFiles), function(file, next) {
			var path = relative(process.cwd(), metalsmith.join(opts.src, file));

			// process raml
			debug('Processing RAML file at %s...', path);
			raml2obj.parse(path, function(obj) {
				debug(require('util').inspect(obj));

				// render each resource
				_.each(obj.resources, function(resource) {
					var destFolder = srcFiles[file].dest.replace(/\\/g, '/');
					var dest = destFolder + '/' + resource.uniqueId.substr(1) + '.html';

					try {
						var html = jade.renderFile(opts.template, { resource: resource, hlp: helpers(opts) });
						files[dest] = { contents: new Buffer(html) };
					} catch (e) {
						console.err(e);
						return next(e);
					}
				});
				metadata.api = obj;
				require('fs').writeFileSync('raml.json', JSON.stringify(obj, null, '\t'));
				next();
			}, next);
		}, done);

	};
};

function helpers(opts) {
	return {
		highlight: function(code) {
			return code;
		},
		markdown: function(md) {
			return marked(md);
		},
		authscope: function(securedBy) {
			if (!securedBy || !securedBy.length || !securedBy[0].oauth2 || !securedBy[0].oauth2.scopes || !securedBy[0].oauth2.scopes.length) {
				return '<i class="icon icon-globe"></i>';
			}
			var icons = '';
			_.each(securedBy[0].oauth2.scopes, function(scope) {
				var klass = '';
				switch (scope) {
					case 'ROOT':
						klass = 'icon icon-crown';
						break;
					case 'ADMIN':
						klass = 'icon icon-badge';
						break;
					case 'CONTRIB':
						klass = 'icon icon-diamond';
						break;
					case 'MEMBER':
						klass = 'icon icon-user';
						break;
					case 'ANON':
						klass = 'icon icon-globe';
						break;
				}
				icons += '<i class="' + klass + '"></i>';
			});
			return icons;

		}
	};
}