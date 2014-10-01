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
var url = require('url');
var jade = require('jade');
var async = require('async');
var debug = require('debug')('metalsmith-raml');
var marked = require('marked');
var raml2obj = require('raml2obj');
var relative = require('path').relative;
var highlight = require('highlight.js');
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
						var html = jade.renderFile(opts.template, { resource: resource, hlp: helpers(_.extend(opts, { api: obj })) });
						files[dest] = { contents: new Buffer(html) };
					} catch (e) {
						console.err('Error rendering.');
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
		markdown: function(md) {
			return marked(md);
		},

		highlight: function(code, isHttp) {
			if (!code) {
				return code;
			}
			if (isHttp) {
				var split = splitReq(code);
				return highlight.highlight('http', split.headers).value + '\r\n\r\n' + highlight.highlight('json', split.body).value;
			}
			return code ? highlight.highlightAuto(code).value : '';
		},

		short: function(text) {
			// create short description
			var dot = text.indexOf('.');
			return marked(text.substring(0, dot > 0 ? dot: text.length));
		},

		toCurl: function(req) {
			var line, words, method;
			var split = splitReq(req);
			var lines = split.headers.split(/\r\n/);
			var cmd = 'curl';
			var validHeaders = [ 'content-type', 'authorization' ];
			for (var i = 0; i < lines.length; i++) {
				line = lines[i];
				if (i === 0) {
					words = line.split(/\s/);
					method = words[0];
					if (method !== 'GET') {
						cmd += ' -X "' + method + '"';
					}
					cmd += ' ' + url.resolve(opts.api.baseUri, words[1]);
				} else {
					words = line.split(/:/);
					if (_.contains(validHeaders, words[0].toLowerCase())) {
						cmd += ' \\\n   -H "' + line.replace(/"/g, '\\"') + '"';
					}
				}
			}
			if (split.body) {
				try {
					cmd += ' \\\n   -d \'' + JSON.stringify(JSON.parse(split.body)).replace(/'/g, "\\'") + '\'';
				} catch (e) {
					cmd = 'Cannot parse JSON body: \n' + e;
				}
			}
			return highlight.highlight('bash', cmd).value;
		},

		authscopes: function(securedBy) {
			if (!securedBy || !securedBy.length || !securedBy[0].jwt || !securedBy[0].jwt.scopes || !securedBy[0].jwt.scopes.length) {
				return [ 'ANON' ];
			}
			return securedBy[0].jwt.scopes;
		},

		authscope: function(scope) {
			switch (scope) {
				case 'ROOT':
					return {
						classes: 'icon icon-crown',
						title: 'Root role needed',
						description: 'You must be **root** in order to access this resource.'
					};
				case 'ADMIN':
					return {
						classes: 'icon icon-badge',
						title: 'Administrator role needed',
						description: 'You must be an **administrator** in order to access this resource.'
					};
				case 'CONTRIB':
					return {
						classes: 'icon icon-diamond',
						title: 'Contributor role needed',
						description: 'You must be a **contributor** in order to access this resource.'
					};
				case 'MEMBER':
					return {
						classes: 'icon icon-user',
						title: 'Registered User role needed',
						description: 'You must be a **registrated user** in order to access this resource.'
					};
				default:
					return {
						classes: 'icon icon-globe',
						title: 'Anonymous access granted',
						description: 'This is a public resource that doesn\'t need any authentication.'
					};
			}
		},

		authscope2: function(securedBy, additionalClasses) {
			additionalClasses = additionalClasses || [];
			if (!securedBy || !securedBy.length || !securedBy[0].jwt || !securedBy[0].jwt.scopes || !securedBy[0].jwt.scopes.length) {
				return '<i class="icon icon-globe' + (additionalClasses.length ? ' ' : '') + additionalClasses.join(' ') + '" title="Anonymous access granted"></i>';
			}
			var icons = '';
			_.each(securedBy[0].jwt.scopes, function(scope) {
				var classes = '';
				var title = '';
				switch (scope) {
					case 'ROOT':
						classes = 'icon icon-crown';
						title = 'Root role needed';
						break;
					case 'ADMIN':
						classes = 'icon icon-badge';
						title = 'Administrator role needed';
						break;
					case 'CONTRIB':
						classes = 'icon icon-diamond';
						title = 'Contributor role needed';
						break;
					case 'MEMBER':
						classes = 'icon icon-user';
						title = 'Registered User role needed';
						break;
					case 'ANON':
						classes = 'icon icon-globe';
						title = 'Anonymous access granted';
						break;
				}
				icons += '<i class="' + classes + (additionalClasses.length ? ' ' : '') + additionalClasses.join(' ') + '" title="' + title + '"></i>';
			});
			return icons;
		}
	};
}

function splitReq(req) {
	if (/\r\n\r\n/.test(req)) {
		var c = req.split(/\r\n\r\n/);
		return {
			headers: c[0],
			body: c[1]
		};
	} else {
		return {
			headers: req,
			body: ''
		};
	}
}