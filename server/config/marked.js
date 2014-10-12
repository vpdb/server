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

var marked = require('marked');
var renderer = new marked.Renderer();
var highlight = require('highlight.js');
var validator = require('validator');

renderer.table = function(header, body) {
	return '<table class="table table-striped">\n' +
		'<thead>\n' +
		header +
		'</thead>\n' +
		'<tbody>\n' +
		body +
		'</tbody>\n' +
		'</table>\n';
};

renderer.list = function(body, ordered) {
	var type = ordered ? 'ol' : 'ul';
	var cssClass = ordered ? '' : ' class="list"';
	return '<' + type + cssClass + '>\n' + body + '</' + type + '>\n';
};

module.exports = {
	gfm: true,
	smartypants: true,
	highlight: function(code, lang) {

		// is it's a http dump with headers and body separated, render both separately.
		if (isHttp(code, lang)) {
			var split = splitReq(code);
			return '<i>' + split.headers + '</i>\r\n\r\n' + highlight.highlight('json', split.body).value;
		}

		// here we have a http dump with no body, so don't highlight at all.
		if (/^[a-z]+\s+[^\s]+\sHTTP\/\d\.\d/i.test(code)) {
			return '<i>' + code + '</i>';
		}

		// curl commands are bash.
		if (/^curl\s/.test(code)) {
			return highlight.highlight('bash', code).value;
		}

		// also don't highlight urls.
		if (validator.isURL(code, { require_protocol: true })) {
			return '<b>' + code + '</b>';
		}

		// otherwise, auto-guess.
		return code ? highlight.highlightAuto(code).value : '';
	},
	renderer: renderer
};

function splitReq(req) {
	if (/\r?\n\r?\n/.test(req)) {
		var c = req.split(/\r?\n\r?\n/);
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

function isHttp(code, lang) {
	if (lang === 'http') {
		return true;
	}
	return /^([1-5]\d{2}|[a-z]+)\s+.*\r?\n([^:]+:.*\r?\n)*\r?\n{/gi.test(code);
}