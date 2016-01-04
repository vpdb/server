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

'use strict';

var _ = require('lodash');
var fs = require('fs');
var ocd = require('ole-doc').OleCompoundDoc;
var async = require('async');
var events = require('events');
var logger = require('winston');
var bindexOf = require('buffer-indexof');

var settings = require('./settings').current;


/**
 * Extracts the table script from a given .vpt file.
 *
 * @param tablePath Path to the .vpt file. File must exist.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Table script</li></ol>
 */
exports.readScriptFromTable = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback(new Error('File "' + tablePath + '" does not exist.'));
	}
	var now = new Date().getTime();
	var doc = new ocd(tablePath);
	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var storage = doc.storage('GameStg');
		if (storage) {
			try {
				var strm = storage.stream('GameData');
				var bufs = [];
				strm.on('data', function(buf) {
					bufs.push(buf);
				});
				strm.on('end', function() {
					var buf = Buffer.concat(bufs);

					var codeStart = bindexOf(buf, new Buffer('04000000434F4445', 'hex')); // 0x04000000 "CODE"
					var codeEnd = bindexOf(buf, new Buffer('04000000454E4442', 'hex'));   // 0x04000000 "ENDB"
					logger.info('[vp] [script] Found GameData for "%s" in %d ms.', tablePath, new Date().getTime() - now);
					if (codeStart < 0 || codeEnd < 0) {
						return callback(new Error('Cannot find CODE part in BIFF structure.'));
					}
					callback(null, {
						code: buf.slice(codeStart + 12, codeEnd).toString(),
						head: buf.slice(0, codeStart + 12),
						tail: buf.slice(codeEnd)
					});
				});
			} catch(err) {
				callback(new Error('Cannot find stream "GameData" in storage "GameStg".'));
			}
		} else {
			callback(new Error('Cannot find storage "GameStg".'));
		}
	});
	doc.read();
};


exports.getTableInfo = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback(new Error('File "' + tablePath + '" does not exist.'));
	}
	var doc = new ocd(tablePath);
	doc.on('err', function(err) {
		logger.warn('[vp] [table info] Error reading file "%s": %s', tablePath, err.message);
		callback(null, {});
	});
	doc.on('ready', function() {
		var storage = doc.storage('TableInfo');
		if (storage) {
			var streams = {
				TableName: 'table_name',
				AuthorName: 'author_name',
				TableBlurp: 'table_blurp',
				TableRules: 'table_rules',
				AuthorEmail: 'author_email',
				ReleaseDate: 'release_date',
				TableVersion: 'table_version',
				AuthorWebSite: 'author_website',
				TableDescription: 'table_description'
			};
			var props = {};
			async.eachSeries(_.keys(streams), function(stream, next) {
				try {
					var strm = storage.stream(stream);
					var bufs = [];
					strm.on('data', function(buf) {
						bufs.push(buf);
					});
					strm.on('end', function() {
						var buf = Buffer.concat(bufs);
						props[streams[stream]] = buf.toString().replace(/\0/g, '');
						next();
					});
					strm.on('err', function(err) {
						logger.warn('[vp] [table info] Error reading stream "%s": %s', stream, err.message);
						next();
					});
				} catch (err) {
					logger.warn('[vp] [table info] Error reading stream "%s" from table: %s', stream, err.message);
					next();
				}
			}, function() {
				callback(null, props);
			});

		} else {
			logger.warn('[vp] [table info] Storage "TableInfo" not found in "%s".', tablePath);
			callback(null, {});
		}
	});
	doc.read();
};