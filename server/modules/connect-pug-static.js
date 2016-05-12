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

var path = require('path'),
	fs = require('fs'),
	pug = require('pug'),
	url = require('url'),
	assert = require('assert');

var defaultOptions = {
	// pug options
	pug: {},
	// Serve index.pug if http://someurl/example/ is requested
	serveIndex: true,
	// Valid pug template extensions
	ext: ['.pug'],
	// Allowed request extension
	allowedExt: ['.pug', '.htm', '.html'],
	// Header for Cache-Control: max-age=0
	maxAge: 0
};

module.exports = function(opts) {

	if (!opts.baseDir)
		throw new Error('baseDir should be set');

	if (!opts.baseUrl)
		throw new Error('baseUrl should be set');

	opts = module.exports.getDefaultOptions(opts);

	return function(req, res, next) {

		if (req.originalUrl.indexOf(opts.baseUrl) !== 0)
			return next();

		var filepath = module.exports.getTplPath(req.originalUrl, opts);

		if (!filepath)
			return next();

		if (filepath.indexOf(opts.baseDir) !== 0)
			return res.sendStatus(403);

		fs.stat(filepath, function(err, stats) {
			if (err)
				return next(err);

			if (!stats.isFile())
				return next();

			pug.renderFile(filepath, opts.pug, function renderFile(err, html) {
				if (err)
					return next(err);

				res.setHeader('Content-Length', Buffer.byteLength(html));
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				var now = +new Date();
				var expires = new Date(now + opts.maxAge);
				res.setHeader('Cache-Control', 'max-age=' + opts.maxAge);
				res.setHeader('Expires', expires.toGMTString());
				return res.end(html);
			});
		});
	};

};

module.exports.getDefaultOptions = function (opts) {
	opts = opts || {};
	Object.keys(defaultOptions).forEach(function (optionName) {
		if (opts[optionName] === undefined) {
			opts[optionName] = defaultOptions[optionName];
		}
	});
	return opts;
};


module.exports.getTplPath = function(requestUrl, opts) {
	opts = module.exports.getDefaultOptions(opts);
	assert(opts.ext && Array.isArray(opts.ext), 'opts.ext should be provided and be an array');
	assert(opts.baseDir, 'opts.baseDir should be provided');

	var parsed = url.parse(requestUrl);
	var pathname = parsed.pathname.replace(opts.baseUrl, '');
	var requestedExt = path.extname(pathname);
	var pathnameWithoutExt = pathname.substr(0, pathname.length - requestedExt.length);

	if (opts.serveIndex && requestedExt === '') {
		// Handle http://example.com/example-path
		if(pathname.substr(-1) !== '/') {
			pathnameWithoutExt += '/';
		}
		// Handle http://example.com/example-path/
		pathnameWithoutExt += 'index';
		requestedExt = opts.allowedExt[0];
	}

	// Allow only .html .htm .pug ...
	if (opts.allowedExt.indexOf(requestedExt) === -1) {
		return null;
	}

	// Search for an existing template file
	for (var i = 0; i < opts.ext.length; i++) {
		var ext = opts.ext[i];
		var filepath = path.join(opts.baseDir, pathnameWithoutExt + ext);
		if (fs.existsSync(filepath)) {
			return filepath;
		}
	}

	return null;
};
