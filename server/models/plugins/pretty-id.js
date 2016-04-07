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
var async = require('async');
var logger = require('winston');
var mongoose = require('mongoose');

var common = require('./common');
var error = require('../../modules/error')('model', 'pretty-id');

/**
 * Plugin that converts pretty IDs to ObjectIds before passing it to mongoose.
 *
 * While the schema uses ObjectIds, the provided `getInstance()` method
 * replaces pretty IDs coming from the API with object IDs. If invalid,
 * validations will fail on the pretty ID.
 *
 * Any reference in the schema will be considered as pretty, unless provided in
 * the `ignore` option.
 *
 * @param schema
 * @param options
 */
module.exports = function(schema, options) {

	options = options || {};

	/* istanbul ignore if */
	if (!options.model) {
		throw new Error('Pretty-id plugin needs model. Please provide.');
	}

	options.ignore = options.ignore || [];
	if (_.isString(options.ignore)) {
		options.ignore = [ options.ignore ];
	}
	options.validations = options.validations || [];

	var paths = _.omitBy(common.traversePaths(schema), (schemaType, path) => {
		return _.includes(options.ignore, path.replace(/\.0$/g, ''));
	});

	/**
	 * Replaces API IDs with database IDs and returns a new instance of the
	 * configured model.
	 *
	 * @param obj Object, directly from API client
	 * @param callback Called with (`err`, `ModelInstance`)
	 * @return {Promise}
	 */
	schema.statics.getInstance = function(obj, callback) {

		return replaceIds(obj, paths, options).then(invalidations => {

			var Model = mongoose.model(options.model);
			var model = new Model(obj);
			//var model = this.model(this.constructor.modelName);

			// for invalid IDs, invalidate instantly so we can provide which value is wrong.
			invalidations.forEach(function(invalidation) {
				model.invalidate(invalidation.path, invalidation.message, invalidation.value);
			});
			return model;

		}).nodeify(callback); // for our "legacy" code
	};

	schema.methods.updateInstance = function(obj) {

		return replaceIds(obj, paths, options).then(invalidations => {

			_.assign(this, obj);

			// for invalid IDs, invalidate instantly so we can provide which value is wrong.
			invalidations.forEach(invalidation => {
				this.invalidate(invalidation.path, invalidation.message, invalidation.value);
			});

			return this;
		});
	};
};

/**
 * Replaceds pretty IDs with MongoDB IDs.
 * @param obj
 * @param paths
 * @param options
 * @returns {Promise.<Array>} Promise returning an array of invalidations.
 */
function replaceIds(obj, paths, options) {

	var Model = mongoose.model(options.model);
	return Promise.try(function() {
		var invalidations = [];
		var models = {};
		models[options.model] = Model;
		var refPaths = getRefPaths(obj, paths);

		return Promise.each(_.keys(refPaths), objPath => {

			var refModelName = refPaths[objPath];
			var RefModel = models[refModelName] || mongoose.model(refModelName);
			models[refModelName] = RefModel;

			var prettyId = _.get(obj, objPath);

			if (!prettyId) {
				return Promise.resolve();
			}
			return RefModel.findOne({ id: prettyId }).then(refObj => {

				if (!refObj) {
					logger.warn('[model] %s ID "%s" not found in database for field %s.', refModelName, prettyId, objPath);
					invalidations.push({ path: objPath, message: 'No such ' + refModelName.toLowerCase() + ' with ID "' + prettyId + '".', value: prettyId });
					_.set(obj, objPath, '000000000000000000000000'); // to avoid class cast error to objectId

				} else {
					// validations
					options.validations.forEach(function(validation) {
						if (validation.path === objPath) {
							if (validation.mimeType && refObj.mime_type !== validation.mimeType) {
								invalidations.push({ path: objPath, message: validation.message, value: prettyId });
							}
							if (validation.fileType && refObj.file_type !== validation.fileType) {
								invalidations.push({ path: objPath, message: validation.message, value: prettyId });
							}
						}
					});

					// convert pretty id to mongdb id
//					console.log('--- Overwriting pretty ID "%s" at %s with %s.', prettyId, objPath, refObj._id);
					_.set(obj, objPath, refObj._id);
				}
				return Promise.resolve();
			});
		}).then(function() {
			return invalidations;
		});
	});
}

function getRefPaths(obj, paths) {

	// pick because it's an object (map)
	var singleRefsFiltered = _.pickBy(paths, schemaType => schemaType.options && schemaType.options.ref);
	var singleRefs = _.mapValues(singleRefsFiltered, schemaType => schemaType.options.ref);

	var arrayRefsFiltered = _.pickBy(paths, schemaType => schemaType.caster && schemaType.caster.instance && schemaType.caster.options && schemaType.caster.options.ref);
	var arrayRefs = _.mapValues(arrayRefsFiltered, schemaType => schemaType.caster.options.ref);

	return common.explodePaths(obj, singleRefs, arrayRefs);
}
