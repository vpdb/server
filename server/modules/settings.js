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
var fs = require('fs');
var util = require('util');
var path_ = require('path');
var crypto = require('crypto');
var logger = require('winston');
var uglify = require('uglify-js');

var validations = require(path_.resolve(__dirname, '../config/settings-validate'));
var dryRun = false;

function Settings() {

	/* istanbul ignore next */
	if (!process.env.APP_SETTINGS || !fs.existsSync(process.env.APP_SETTINGS)) {
		if (process.env.APP_SETTINGS) {
			throw new Error('Cannot find settings at "' + process.env.APP_SETTINGS + '". Copy server/config/settings-dist.js to server/config/settings.js or point `APP_SETTINGS` environment variable to correct path.');
		} else {
			var e = new Error('Settings location not found. Please set the `APP_SETTINGS` environment variable to your configuration file and retry.');
			console.error(e.stack);
			throw e;
		}
	}
	this.filePath = process.env.APP_SETTINGS;
	this.current = require(this.filePath.substr(0, this.filePath.length - 3));
}

/* istanbul ignore next */
/**
 * Checks that all settings are available and runs validation on each.
 *
 * @return true if passes, false otherwise.
 */
Settings.prototype.validate = function() {

	logger.info('[settings] Validating settings at %s', this.filePath);
	var settings = this.current;

	var validate = function(validation, setting, path) {
		var success = true;
		var validationError, p, i, j;
		var logError = function(p, error, setting) {
			setting = !_.isUndefined(error.setting) ? error.setting : setting;
			var s = _.isObject(setting) ? JSON.stringify(setting) : setting;
			if (_.isObject(error)) {
				logger.error('[settings] %s.%s [KO]: %s (%s).', p, error.path, error.message, s);
			} else {
				logger.error('[settings] %s [KO]: %s (%s).', p, error, s);
			}
		};
		for (var s in validation) {
			if (validation.hasOwnProperty(s)) {
				p = (path + '.' + s).substr(1);

				// validation function
				if (_.isFunction(validation[s])) {
					if (_.isUndefined(setting[s]) && setting.enabled !== false) {
						logger.error('[settings] %s [KO]: Setting is missing.', p);
						success = false;
					} else {
						validationError = validation[s](setting[s], settings);
						if (!validationError) {
							logger.info('[settings] %s [OK]', p);
						} else {
							if (_.isArray(validationError)) {
								for (j = 0; j < validationError.length; j++) {
									logError(p, validationError[j], setting[s]);
								}
							} else {
								logError(p, validationError, setting[s]);
							}
							success = false;
						}
					}
				}

				// array
				else if (validation[s].__array) {
					if (!_.isArray(setting[s])) {
						logger.error('[settings] %s [KO]: Setting must be an array.', p);
						success = false;
					} else {
						for (i = 0; i < setting[s].length; i++) {
							if (!validate(validation[s], setting[s][i], path + '.' + s + '[' + i + ']')) {
								//logger.error('[settings] %s failed', path);
								success = false;
							}
						}
					}
				}

				// object
				else if (validation[s] && _.isObject(validation[s])) {

					if (_.isUndefined(setting[s])) {
						logger.error('[settings] %s [KO]: Setting block is missing.', p);
						success = false;

					} else if (!validate(validation[s], setting[s], path + '.' + s)) {
						//logger.error('[settings] %s failed', path);
						success = false;
					}
				}

			}
		}
		if (success && !path) {
			logger.info('[settings] Congrats, your settings look splendid!');
		}
		return success;
	};
	return validate(validations, settings, '');
};

/* istanbul ignore next */
Settings.prototype.migrate = function(callback) {

	var settingsCurrName = path_.basename(this.filePath);
	var settingsDistPath = path_.resolve(__dirname, '../config/settings-dist.js');
	var settingsDist = fs.readFileSync(settingsDistPath, { encoding: 'utf8' }).trim().replace(/\x0D\x0A/gi, '\n');
	var settingsCurr = fs.readFileSync(this.filePath, { encoding: 'utf8' }).trim().replace(/\x0D\x0A/gi, '\n');
	var result = { added: [], errors: [] };

	if (settingsCurr !== settingsDist) {

		logger.info('[settings] Checking for new settings.');

		// 1. retrieve added properties
		var oldTree = {};
		var newTree = {};
		eval(settingsCurr.replace(/module\.exports\s*=\s*\{/, 'oldTree = {')); // jshint ignore:line
		eval(settingsDist.replace(/module\.exports\s*=\s*\{/, 'newTree = {')); // jshint ignore:line
		var newProps = diff(oldTree, newTree);
		if (newProps.length === 0) {
			logger.info('[settings] No new settings found.');
			return callback(result);
		}
		logger.info('[settings] Found new settings: [' + newProps.join(', ') + ']');

		// 2. retrieve code blocks of added properties
		var nodesNew = analyze(uglify.parse(settingsDist));

		// 3. inject code blocks into settings.js
		var settingsPatched = _.clone(settingsCurr);
		var settingsNew = _.pick(nodesNew, newProps);
		var settingsNewKeys = _.keys(settingsNew);
		var ast;
		for (var i = 0; i < settingsNewKeys.length; i++) {
			var path = settingsNewKeys[i]; // path in settings to be added
			var node = settingsNew[path];  // ast node corresponding to the setting to be added
			try {
				// analyze current settings, so we know where to inject
				ast = analyze(uglify.parse(settingsPatched));
			} catch (err) {
				logger.error('[settings] Error parsing patched file: ' + err);
				result.errors.push({
					when: 'settings',
					message: err.message,
					obj: err
				});
				fs.writeFileSync('settings-err.js', settingsPatched);
				logger.error('[settings] File dumped to settings-err.js.');
				return callback(result);
			}

			// check if not already available
			if (!ast[path]) {
				logger.info('[settings] Patching %s with setting "%s"', settingsCurrName, path);

				var comment = node.start.comments_before.length > 0;
				var start = comment ? node.start.comments_before[0].pos : node.start.pos;
				var len = comment ? node.end.endpos - start : node.end.endpos - start;
				var codeBlock = settingsDist.substr(start, len);
//				logger.info('start: %d, len: %d, hasComment: %s', start, len, comment);
//				logger.info('\n===============\n%s\n===============\n', util.inspect(node, false, 10, true));
//				logger.info('settingsDist:\n%s', settingsDist);

				// inject at the end of an element
				var parentPath;
				if (path.indexOf('.') > 0) {
					parentPath = path.substr(0, path.lastIndexOf('.'));
					settingsPatched = patch(settingsPatched, codeBlock, ast[parentPath].end.pos, parentPath);

				// inject the end of the file.
				} else {
					settingsPatched = patch(settingsPatched, codeBlock, settingsPatched.length - 2);
				}

				// add message to result
				var descr = node.start.comments_before[0] ? node.start.comments_before[0].value.trim() : null;
				var important = false;
				if (descr) {

					if (descr.match(/\*\s*@important/i)) {
						descr = descr.replace(/\s*\*\s*@important\s*/g, '');
						important = true;
					}
					descr = descr.replace(/\s*\*\s+\*\s*/g, '\n');
					descr = descr.replace(/\s*\*\s*/g, ' ').trim();

				}
				result.added.push({
					parent: parentPath ? parentPath : null,
					path: path,
					name: node.start.value,
					value: node.end.value,
					valuetype: node.end.type,
					description: descr,
					important: important
				});

			} else {
				logger.info('[settings] %s already contains "%s", skipping.', settingsCurrName, path);
			}
		}
		if (!dryRun) {
			fs.writeFileSync(this.filePath, settingsPatched);
			logger.info('[settings] Patched %s written.', settingsCurrName);
		} else {
			fs.writeFileSync('settings-patched.js', settingsPatched);
			logger.info('[settings] Updated settings-patched.js.');
		}
		callback(result);

	} else {
		logger.info('[settings] Settings are identical, moving on.');
		callback(result);
	}
};


/**
 * Takes the AST object and hacks it into sub-objects per property. Returns
 * a dictionary with path separated by "." as key, and sub-tree as value.
 *
 * Since this is a recursive function, only the first parameter must be
 * provided at first run.
 *
 * @param {object} tree Current subtree
 * @param {string} [path] Current path
 * @param [node] If property found, this is the subtree
 * @returns {Object}
 */
function analyze(tree, path, node) {
	var nodes = {};
	if (node) {
		nodes[path] = node;
	}
	var i;
	if (tree.right) {
		_.extend(nodes, analyze(tree.right, path));
	} else if (tree.properties) {
		for (i = 0; i < tree.properties.length; i++) {
			var nextPath = (path ? path + '.' : '') + tree.properties[i].key;
			_.extend(nodes, analyze(tree.properties[i].value, nextPath, tree.properties[i]));
		}
	} else if (tree.body) {
		if (_.isArray(tree.body)) {
			for (i = 0; i < tree.body.length; i++) {
				_.extend(nodes, analyze(tree.body[i], path));
			}
		} else {
			_.extend(nodes, analyze(tree.body, path));
		}
	}
	return nodes;
}


/**
 * Returns an array of path names (sepearted separated by ".") for all
 * attributes in newTree that are not in oldTree.
 *
 * @param oldTree Settings object before
 * @param newTree Settings object after
 * @param parent Parent path, only needed when called recursively.
 * @returns {Array}
 */
function diff(oldTree, newTree, parent) {
	parent = parent ? parent : '';
	var newProps = _.difference(_.keys(newTree), _.keys(oldTree));
	var comProps = _.intersection(_.keys(newTree), _.keys(oldTree));
	var newValues = _.map(newProps, function (key) {
		return parent ? parent + '.' + key : key;
	});
	for (var i = 0; i < comProps.length; i++) {
		var prop = oldTree[comProps[i]];
		if (_.isObject(prop)) {
			var p = parent ? parent + '.' + comProps[i] : comProps[i];
			newValues = newValues.concat(diff(oldTree[comProps[i]], newTree[comProps[i]], p));
		}
	}
	return newValues;
}

function patch(settingsPatched, codeBlock, pos, parentPath) {
//	console.log('PATCHING:\n--- code ---\n%s\n--- /code ---\nat pos %d below "%s"', codeBlock, pos, parentPath);
	var before = settingsPatched.substr(0, pos);
	var after = settingsPatched.substr(pos);
	var level = parentPath ? parentPath.split('.').length : 0;
	var indent = '';
	for (var i = 0; i < level; i++) {
		indent += '\t';
	}
	return before.trim() + ',\n\n\t' + indent + codeBlock.trim().replace(/,$/, '') + '\n' + indent + after.trim();
}

Settings.prototype.apiUri = function(path) {
	return this.current.vpdb.api.protocol + '://' +
	       this.current.vpdb.api.hostname +
	      (this.current.vpdb.api.port === 80 || this.current.vpdb.api.port === 443 ? '' : ':' + this.current.vpdb.api.port) +
	       this.current.vpdb.api.pathname + (path || '');
};

Settings.prototype.apiPath = function(path) {
	return this.current.vpdb.api.pathname + (path || '');
};

Settings.prototype.storagePath = function(path) {
	return this.current.vpdb.storageApi.pathname + (path || '');
};

Settings.prototype.webUri = function() {
	return this.current.vpdb.webapp.protocol + '://' +
	       this.current.vpdb.webapp.hostname +
	      (this.current.vpdb.webapp.port === 80 || this.current.vpdb.webapp.port === 443 ? '' : ':' + this.current.vpdb.webapp.port);
};

Settings.prototype.clientConfig = function() {
	return {
		authHeader: this.current.vpdb.authorizationHeader,
		apiUri: this.current.vpdb.api,
		storageUri: this.current.vpdb.storageApi,
		webUri: this.current.vpdb.webapp
	};
};

Settings.prototype.clientConfigName = function() {
	var data = util.inspect(this.clientConfig());
	var md5sum = crypto.createHash('md5');
	md5sum.update(data);
	return 'config_' + md5sum.digest('hex').substr(0, 7) + '.js';
};

module.exports = new Settings();