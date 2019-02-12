/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const { promisify, isObject, isArray } = require('util');

const sortKeys = require('sort-keys');
const glob = promisify(require('glob'));

/**
 * The goal is to have diffable files. It:
 *
 *    - removes the first line (the request URL / response code)
 *    - sorts and converts headers to lowercase
 *    - replaces authorization header value with "***"
 *    - sorts payload
 *    - replaces payload values by ""
 *
 * npm install --no-save glob sort-keys
 */
(async () => {

	try {
		const pwd = process.argv[2] || '.';
		const where = resolve(pwd, './**/http/*.json');
		console.log('Retrieving files from %s...', where);
		const files = await glob(where);
		for (file of files) {
			let content = readFileSync(file).toString();
			content = removeFirstLine(content.trim());

			let [headers, body] = splitBody(content);

			//console.log('\n\n=================================');
			console.log(file);

			headers = normalizeHeaders(headers);
			body = normalizeBody(body);

			content = headers + (body ? '\n\n' + body : '');

			writeFileSync(file, content);
			//console.log(content);
		}
	} catch (err) {
		console.error('ERROR:', err);
	}
})();

function removeFirstLine(str) {
	return str.indexOf('\n') > 0 ? str.substring(str.indexOf('\n') + 1, str.length) : '';
}

function splitBody(str) {
	return str.split(/\n\r?\n\r?/, 2);
}

function normalizeHeaders(str) {
	if (!str) {
		return '';
	}
	const removeHeaders = ['etag', 'x-response-time', 'content-encoding', 'content-length', 'accept-encoding', 'accept', 'x-cache-api'];
	return str.split(/\n\r?/)
		.filter(line => {
			for (const h of removeHeaders) {
				if (line.toLowerCase().startsWith(h + ':')) {
					return false;
				}
			}
			return true;
		})
		.map(h => h.split(/:\s?/, 2))
		.map(kv => kv[0].toLowerCase() + ': ' + normalizeHeaderValue(kv[0].toLowerCase(), kv[1]))
		.sort()
		.join('\n');

}

function normalizeHeaderValue(key, value) {
	if (key === 'authorization') {
		return value.split(' ')[0] + ' ***';
	}
	return value;
}

function normalizeBody(body) {
	if (!body) {
		return '';
	}
	let obj = normalizeBodyValues(JSON.parse(body), '');
	if (isArray(obj)) {
		obj = obj.map(o => sortKeys(o, { deep: true }));
	} else {
		obj = sortKeys(obj, { deep: true });
	}
	return JSON.stringify(obj, null, '  ');
}

//
// const keepObjectPaths = [
// 	/^error$/,
// 	/^errors\.\d+\.field$/
// ];

function normalizeBodyValues(obj, path) {
	for (const key of Object.keys(obj)) {
		const currentPath = path + key;
		if (isObject(obj[key])) {
			normalizeBodyValues(obj[key], currentPath + '.');
		} else if (isArray(obj)) {
			obj.sort();

		} else {
			//if (!keepObjectPaths.find(regex => regex.test(currentPath))) {
			obj[key] = '';
			//}
		}
	}
	return obj;
}