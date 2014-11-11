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
var async = require('async');
var logger = require('winston');
var mongoose = require('mongoose');
var objectPath = require('object-path');

var error = require('../../modules/error')('model', 'pretty-id');

module.exports = exports = function(schema, options) {

	options = options || {};

	/* istanbul ignore if */
	if (!options.model) {
		throw new Error('Fileref plugin needs model. Please provide.');
	}

	options.ignore = options.ignore || [];
	if (_.isString(options.ignore)) {
		options.ignore = [ options.ignore ];
	}

	/**
	 * Replaces API IDs with database IDs and returns a new instance of the
	 * configured model.
	 *
	 * @param obj Object, directly from API client
	 * @param callback Called with (`err`, `ModelInstance`)
	 */
	schema.statics.getInstance = function(obj, callback) {

		var Model = mongoose.model(options.model);
		var models = {};
		models[options.model] = Model;

		var paths = _.omit(traversePaths(schema), function(schemaType, path) {
			return _.contains(options.ignore, path);
		});
		var singleRefs = _.mapValues(_.pick(paths, function(schemaType) {
			return schemaType.options && schemaType.options.ref;
		}), function(schemaType) {
			return schemaType.options.ref;
		});
		var arrayRefs = _.mapValues(_.pick(paths, function(schemaType) {
			return schemaType.caster && schemaType.caster.instance && schemaType.caster.options && schemaType.caster.options.ref;
		}), function(schemaType) {
			return schemaType.caster.options.ref;
		});
		console.log('------------ SINGLE REFS:');
		console.log(singleRefs);
		console.log('------------ ARRAY REFS:');
		console.log(arrayRefs);

		var objPaths = explodePaths(obj, singleRefs, arrayRefs);

		var invalidations = [];
		async.eachSeries(_.keys(objPaths), function(objPath, next) {

			var refModelName = objPaths[objPath];
			var RefModel = models[refModelName] || mongoose.model(refModelName);
			models[refModelName] = RefModel;

			var prettyId = objectPath.get(obj, objPath);

			if (!prettyId) {
				return next();
			}
			RefModel.findOne({ id: prettyId }, function(err, refObj) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[model] Error finding referenced %s: %s', refModelName.toLowerCase(), err.message);
					return next(err);
				}
				if (!refObj) {
					logger.warn('[model] %s ID "%s" not found in database for field %s.', refModelName, prettyId, objPath);
					invalidations.push({ path: objPath, message: 'No such ' + refModelName.toLowerCase() + ' with ID "' + prettyId + '".', value: prettyId });
					objectPath.set(obj, objPath, '000000000000000000000000'); // to avoid class cast error to objectId
				} else {
					objectPath.set(obj, objPath, refObj._id);
				}
				//console.log('***** %s: %s -> %s', objPath, prettyId, refObj._id);
				next();
			});

		}, function(err) {
			/* istanbul ignore if  */
			if (err) {
				return callback(err);
			}

			console.log('------------ FINAL OBJECT:');
			console.log(require('util').inspect(obj, { colors: true, depth: null }));
			var model = new Model(obj);

			// for invalid IDs, invalidate instantly so we can provide which value is wrong.
			_.each(invalidations, function(invalidation) {
				model.invalidate(invalidation.path, invalidation.message, invalidation.value);
			});

			callback(null, model);
		});
	};
};


/**
 * Returns all paths of a given schema.
 * @param {object} schema
 * @param {string} [prefix] Internal usage only
 * @param {object} [paths] Internal usage only
 * @returns {object} Keys: path, Values: Schema type
 */
function traversePaths(schema, prefix, paths) {
	prefix = prefix || '';
	paths = paths || {};
	schema.eachPath(function(path, schemaType) {
		var isArray = schemaType.options && _.isArray(schemaType.options.type);
		var fullPath = prefix + (prefix ? '.' : '') + path + (isArray ? '.0' : '');
		paths[fullPath] = schemaType;
		if (schemaType.schema) {
			traversePaths(schemaType.schema, fullPath, paths);
		}
	});
	return paths;
}

/**
 * This applies the paths from the model to the actual object. If a path is
 * part of an array and the object contains multiple values, the path is
 * repeated as many times as in the object.
 *
 * For instance, if our model has the following paths:
 *
 * var singleRefs = {
 *    _game: 'Game',
 *    'original_version._ref': 'Release',
 *    _created_by: 'User',
 *    'versions.0.files.0._file': 'File',
 *    'versions.0.files.0._media.playfield_image': 'File',
 *    'versions.0.files.0._media.playfield_video': 'File'
 * };
 *
 * var arrayRefs = { _tags: 'Tag' }
 *
 * and the object contains 2 files and 2 tags, it would return:
 *
 * { _game: 'Game',
 *   'original_version._ref': 'Release',
 *   _created_by: 'User',
 *   'versions.0.files.0._file': 'File',
 *   'versions.0.files.1._file': 'File',
 *   'versions.0.files.0._media.playfield_image': 'File',
 *   'versions.0.files.1._media.playfield_image': 'File',
 *   'versions.0.files.0._media.playfield_video': 'File',
 *   'versions.0.files.1._media.playfield_video': 'File',
 *   '_tags.0': 'Tag',
 *   '_tags.1': 'Tag'
 * }
 *
 * @param {object} obj Submitted object from the user
 * @param {object} singleRefs Reference paths with one value
 * @param {object} arrayRefs Reference paths that contain an array of values
 * @returns {object} Exploded paths
 */
function explodePaths(obj, singleRefs, arrayRefs) {

	var appendNext = function(obj, parts, refModelName, level, path) {
		level = level || 0;
		var paths = {};
		var objPath = parts[level];
		if (!objPath) {
			return {};
		}
		path = path || '';
		path += (path ? '.' : '') + objPath;
		if (!parts[level + 1]) {
			paths[path] = refModelName;
		}
		var subObj = objectPath.get(obj, objPath);
		if (subObj) {
			for (var i = 0; i < subObj.length; i++) {
				paths = _.extend(paths, appendNext(subObj[i], parts, refModelName, level + 1, path + '.' + i));
			}
		}
		return paths;
	};
	var paths = {};
	_.each(singleRefs, function(refModelName, path) {
		paths = _.extend(paths, appendNext(obj, path.split(/\.\d+\.?/), refModelName));
	});

	var arrayPaths = {};
	var arrayPathsExploded = {};
	_.each(arrayRefs, function(refModelName, path) {
		arrayPaths = _.extend(arrayPaths, appendNext(obj, path.split(/\.\d+\.?/), refModelName));
	});
	_.each(arrayPaths, function(refModelName, path) {
		var subObj = objectPath.get(obj, path);
		if (_.isArray(subObj) && subObj.length > 0) {
			for (var i = 0; i < subObj.length; i++) {
				arrayPathsExploded[path + '.' + i] = refModelName;
			}
		}
	});
	return _.extend(paths, arrayPathsExploded);
}