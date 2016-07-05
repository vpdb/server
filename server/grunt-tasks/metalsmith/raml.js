/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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
var pug = require('pug');
var async = require('async');
var debug = require('debug')('metalsmith-raml');
var raml2obj = require('raml2obj');
var relative = require('path').relative;
var highlight = require('highlight.js');
var resolve = require('path').resolve;
var normalize = require('path').normalize;
var md = require('../../modules/md');

module.exports = function(opts) {

	opts = opts || {};
	opts.src = opts.src || 'src';
	opts.files = opts.files || {};
	opts.template = opts.template || 'template.pug';

	// we need a file-based dictionary, so convert the name-based one.
	var configuredFiles = {};
	_.each(opts.files || {}, function(value, key) {
		configuredFiles[normalize(value.src)] = { dest: value.dest, name: key };
	});

	return function(files, metalsmith, done) {

		debug("Generating RAML doc...");

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
		if (!metadata.api) {
			metadata.api = {};
		}

		// for each api
		async.each(_.keys(srcFiles), function(file, next) {

			var path = relative(process.cwd(), resolve(opts.src, file));

			// process raml
			debug('Processing RAML file at %s...', path);

			raml2obj.parse(path).then(function(obj) {

				try {
					// render each resource
					_.each(obj.resources, function(resource) {

						var destFolder = srcFiles[file].dest.replace(/\\/g, '/');
						var dest = destFolder + '/' + resource.uniqueId + '.html';
						var html = pug.renderFile(opts.template, {
							resource: resource,
							hlp: helpers(_.extend(opts, { api: obj })),
							print: print
						});

						debug("Creating %s...", dest);

						files[dest] = { contents: new Buffer(html) };
					});
					metadata.api[srcFiles[file].name] = obj;
					postman(obj);
					require('fs').writeFileSync('raml.json', JSON.stringify(obj, null, '\t'));
					next();

				} catch (e) {
					console.error(e);
					return next(e);
				}
			}, function(err) {
				console.error(err);
				next(err);
			});
		}, done);

	};
};

function helpers(opts) {
	return {
		markdown: function(str) {
			return str ? md.render(str) : '';
		},

		highlight: function(code, isHttp) {
			if (!code) {
				return code;
			}
			if (isHttp) {
				var split = splitReq(code);
				var headers = highlight.highlight('http', split.headers).value;
				headers = headers.replace(/Bearer\s+([^\s<>]+)/g, 'Bearer <api-token default="$1"></api-token>');
				return headers + '\r\n\r\n' + highlight.highlight('json', split.body).value;
			}
			return code ? highlight.highlightAuto(code).value : '';
		},

		short: function(text) {
			if (!text) {
				return text;
			}
			// create short description
			var dot = text.indexOf('.');
			return md.renderInline(text.substring(0, dot > 0 ? dot: text.length));
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
					if (_.includes(validHeaders, words[0].toLowerCase())) {
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
			var highlighted = highlight.highlight('bash', cmd).value;
			highlighted = highlighted.replace(/\sBearer\s+([^\s"]+)/g, ' Bearer <api-token default="$1"></api-token>');
			return highlighted;
		},

		authscopes: function(securedBy) {
			if (!securedBy || !securedBy.length || !securedBy[0].jwt || !securedBy[0].jwt.scopes || !securedBy[0].jwt.scopes.length) {
				return [ 'ANON' ];
			}
			return securedBy[0].jwt.scopes;
		},

		authscope: function(scope) {
			switch (scope ? scope.toUpperCase() : 'ANON') {
				case 'ROOT':
					return {
						classes: 'icon icon-crown',
						title: 'Root Access',
						description: 'You must be **root** in order to access this resource.'
					};
				case 'ADMIN':
					return {
						classes: 'icon icon-badge',
						title: 'Administrator Access',
						description: 'You must be an **administrator** in order to access this resource.'
					};
				case 'MODERATOR':
					return {
						classes: 'icon icon-diamond',
						title: 'Moderator Access',
						description: 'You must be a **moderator** in order to access this resource.'
					};
				case 'CONTRIB':
					return {
						classes: 'icon icon-diamond',
						title: 'Contributor Access',
						description: 'You must be a **contributor** in order to access this resource.'
					};
				case 'MEMBER':
					return {
						classes: 'icon icon-user',
						title: 'Registered User',
						description: 'You must be a **registered user** in order to access this resource.'
					};
				default:
					return {
						classes: 'icon icon-globe',
						title: 'Anonymous Access',
						description: 'This is a public resource that doesn\'t need any authentication.'
					};
			}
		},

		requestByType: function(body) {
			var that = this;
			if (!_.isObject(body)) {
				return {};
			}
			var byType = {};
			_.each(body, function(request, type) {

				// ignore requests without example
				if (!request.example) {
					return;
				}
				var t = that.splitType(type);
				byType[t.name] = {
					role: t.role,
					request: request
				};
			});
			return byType;
		},

		responseByType: function(responses) {
			var that = this;
			if (!_.isObject(responses)) {
				return {};
			}
			var byType = {};
			_.each(responses, function(block, code) {
				if (block.body) {
					_.each(block.body, function(response, type) {

						// ignore responses without example
						if (!response.example) {
							return;
						}
						var t = that.splitType(type);
						if (!byType[t.name]) {
							byType[t.name] = [];
						}
						byType[t.name].push({
							code: code,
							role: t.role,
							response: response
						});

					});
				}
			});
			return byType;
		},

		/**
		 * Extracts role and name from our "custom type".
		 *
		 * Example: type = "role/member-Search-for-User"
		 *        result = { role: 'member', name: 'Search for User' }
		 *
		 * @param {string} type Full content type from RAML
		 * @param {string} [defaultName] Name to be returned if none in type
		 * @returns {{role: string, name: string}}
		 */
		splitType: function(type, defaultName) {
			var name, t = type.split('/')[1].split('-');
			var role = t[0];
			if (t.length > 1) {
				t.splice(0, 1);
				name = t.join(' ');
			} else {
				name = defaultName || 'default';
			}
			return { role: role, name: name };
		},

		schema: function(schemaStr, opts) {
			var schema = JSON.parse(schemaStr);
			var props = schema.properties;

			// "onlyIn" filtering
			props = _.pickBy(props, function(prop, name) {
				if (!_.isArray(prop.onlyIn)) {
					return true;
				}
				for (var i = 0; i < prop.onlyIn.length; i++) {
					var onlyIn = prop.onlyIn[i];
					if (onlyIn.type && onlyIn.type !== opts.type) {
						continue;
					}
					if (onlyIn.method && onlyIn.method.toLowerCase() !== opts.method.toLowerCase()) {
						continue;
					}
					if (onlyIn.path && onlyIn.path !== opts.path) {
						continue;
					}
					return true;
				}
				return false;
			});

			// custom filtering
			if (opts.filter) {
				_.each(opts.filter, function(filterVal, filterKey) {
					props = _.pickBy(props, function(prop) {
						return _.isUndefined(prop[filterKey]) || prop[filterKey] === filterVal;
					});
				});
			}

			schema.properties = props;
			return schema;
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

function print(obj) {
	console.log(require('util').inspect(obj, false, true));
}

function postman(obj) {

	let collectionId = generateGUID();
	let data = {
		id: collectionId,
		name: "VPDB API",
		description: "VPDB's REST API.",
		order: [],
		folders: [ ],
		timestamp: new Date().getTime(),
		owner: 0,
		remoteLink: "",
		'public': false,
		requests: []
	};

	parsePostmanResource(data, '/v1', obj.resources, collectionId);
	require('fs').writeFileSync('postman.json', JSON.stringify(data, null, '\t'));
}

function parsePostmanResource(data, relativeUri, resources, collectionId, lastFolder) {

	resources.forEach(resource => {
		let folder = lastFolder || {
			id: generateGUID(),
			name: resource.displayName,
			description: shortDescription(resource.description),
			order: [ ],
			owner: 0,
			collectionId: collectionId
		};
		resource.methods.forEach(method => {
			let request = {
				id: generateGUID(),
				headers: "Content-Type: application/json\n",
				url: "{{url}}" + relativeUri + resource.relativeUri,
				preRequestScript: null,
				pathVariables: {},
				method: method.method,
				data: [],
				dataMode: "raw",
				version: 1,
				tests: null,
				currentHelper: "normal",
				helperAttributes: {},
				time: new Date().getTime(),
				name: relativeUri + resource.relativeUri,
				description: shortDescription(method.description),
				collectionId: collectionId,
				responses: [],
				rawModeData: ""
			};
			if (method.securedBy && _.compact(method.securedBy).length) {
				request.headers += '{{authheader}}: Bearer {{apikey}}\n';
			}
			if (_.includes(['put', 'post'], method.method) && _.keys(method.body).length && method.body[_.keys(method.body)[0]].example) {
				var example = splitReq(method.body[_.keys(method.body)[0]].example);
				request.rawModeData = example.body;
			}
			request.url = request.url.replace(/\/\{([^{}]+)/g, '/{{$1}'); // make the {id} placeholders usuable as {{id}}
			data.requests.push(request);
			folder.order.push(request.id);
		});
		if (_.isArray(resource.resources)) {
			parsePostmanResource(data, relativeUri + resource.relativeUri, resource.resources, collectionId, folder);
		}
		if (!_.includes(data.folders, folder)) {
			data.folders.push(folder);
		}
	});
}

function shortDescription(text) {
	if (!text) {
		return text;
	}
	var dot = text.indexOf('.');
	return text.substring(0, dot > 0 ? dot: text.length).replace(/[\r\n]+/g, ' ');
};

function generateGUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}