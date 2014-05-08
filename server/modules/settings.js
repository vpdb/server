var _ = require('underscore');
var fs = require('fs');
var path_ = require('path');
var logger = require('winston');
var uglify = require('uglify-js');

var validations = require(path_.resolve(__dirname, '../config/settings-validate'));
var dryRun = false;

function Settings() {
	var msg;

	// 1. check for env variable
	if (process.env.APP_SETTINGS) {
		if (fs.existsSync(process.env.APP_SETTINGS)) {
			this.filePath = process.env.APP_SETTINGS;
		} else {
			msg = 'Cannot find settings at "' + process.env.APP_SETTINGS + '", check your env variable APP_SETTINGS.';
			logger.error('[settings] %s', msg);
			throw msg;
		}

	// 2. read from server/config
	} else {
		var filePath = path_.resolve(__dirname, '../config/settings.js');
		if (fs.existsSync(filePath)) {
			this.filePath = filePath;
		} else {
			msg = 'Cannot find settings at "' + filePath + '", copy server/config/settings-dist.js to server/config/settings.js or point APP_SETTINGS env variable to correct path.';
			logger.error('[settings] %s', msg);
			throw msg;
		}
	}
	this.current = require(this.filePath.substr(0, this.filePath.length - 3));
}

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
		var validationError, p, i;
		for (var s in validation) {
			if (validation.hasOwnProperty(s)) {
				p = (path + '.' + s).substr(1);

				// validation function
				if (_.isFunction(validation[s])) {
					if (_.isUndefined(setting[s])) {
						logger.error('[settings] %s [KO]: Setting is missing.', p);
						success = false;
					} else {
						validationError = validation[s](setting[s]);
						if (!validationError) {
							logger.info('[settings] %s [OK]', p);
						} else {
							logger.error('[settings] %s [KO]: %s (%s).', p, validationError, setting[s]);
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

Settings.prototype.migrate = function(callback) {

	var settingsCurrName = path_.basename(this.filePath);
	var settingsDistPath = path_.resolve(__dirname, '../config/settings-dist.js');
	var settingsDist = fs.readFileSync(settingsDistPath, { encoding: 'utf8' }).trim().replace(/\x0D\x0A/gi, '\n');
	var settingsCurr = fs.readFileSync(this.filePath, { encoding: 'utf8' }).trim().replace(/\x0D\x0A/gi, '\n');
	var result = { added: [], errors: [] };

	if (settingsCurr != settingsDist) {

		logger.info('[settings] Checking for new settings.');

		/**
		 * Returns an array of path names (sepearted separated by ".") for all
		 * attributes in newTree that are not in oldTree.
		 *
		 * @param oldTree Settings object before
		 * @param newTree Settings object after
		 * @param parent Parent path, only needed when called recursively.
		 * @returns {Array}
		 */
		var diff = function (oldTree, newTree, parent) {
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
		};

		/**
		 * Takes the AST object and hacks it into sub-objects per property. Returns
		 * a dictionary with path separated by "." as key, and sub-tree as value.
		 *
		 * Since this is a recursive function, only the first parameter must be
		 * provided at first run.
		 *
		 * @param tree Current subtree
		 * @param path Current path
		 * @param node If property found, this is the subtree
		 * @returns {Object}
		 */
		var analyze = function (tree, path, node) {
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
		};

		var patch = function (settingsPatched, codeBlock, pos, parentPath) {
//			console.log('PATCHING:\n--- code ---\n%s\n--- /code ---\nat pos %d below "%s"', codeBlock, pos, parentPath);
			var before = settingsPatched.substr(0, pos);
			var after = settingsPatched.substr(pos);
			var level = parentPath ? parentPath.split('.').length : 0;
			var indent = '';
			for (var i = 0; i < level; i++) {
				indent += '\t';
			}
			return before.trim() + ',\n\n\t' + indent + codeBlock.trim().replace(/,$/, '') + '\n' + indent + after.trim();
		};

		// 1. retrieve added properties
		var oldTree = {};
		var newTree = {};
		eval(settingsCurr.replace(/module\.exports\s*=\s*\{/, 'oldTree = {'));
		eval(settingsDist.replace(/module\.exports\s*=\s*\{/, 'newTree = {'));
		var newProps = diff(oldTree, newTree);
		if (newProps.length == 0) {
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
		for (var i = 0; i < settingsNewKeys.length; i++) {
			var path = settingsNewKeys[i]; // path in settings to be added
			var node = settingsNew[path];  // ast node corresponding to the setting to be added
			try {
				// analyze current settings, so we know where to inject
				var ast = analyze(uglify.parse(settingsPatched));
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
				if (path.indexOf('.') > 0) {
					var parentPath = path.substr(0, path.lastIndexOf('.'));
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

Settings.prototype.publicUrl = function(config) {
	return 'http' +
		(config.vpdb.httpsEnabled ? 's' : '') +
		'://' +
		config.vpdb.host +
		(config.vpdb.httpsEnabled || config.vpdb.port == 80 ? '' : ':' + config.vpdb.port)
};

module.exports = new Settings();