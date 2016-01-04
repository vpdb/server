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
var mongoose = require('mongoose');

module.exports = function(schema, options) {

	options = options || {};
	var fields = options.fields || [];
	var message = options.message || "{PATH} references a non existing ID";

	schema.eachPath(function (path, schemaType) {
		var validateFunction = null;
		var refModelName = null;
		var conditions = {};

		if (fields.length > 0 && !_.contains(fields, path)) {
			return;
		}

		if (schemaType.options && schemaType.options.ref) {
			validateFunction = validateId;
			refModelName = schemaType.options.ref;
			if (schemaType.options.refConditions) {
				conditions = schemaType.options.refConditions;
			}
		} else if (schemaType.caster && schemaType.caster.instance && schemaType.caster.options && schemaType.caster.options.ref) {
			validateFunction = validateIdArray;
			refModelName = schemaType.caster.options.ref;
			if (schemaType.caster.options.refConditions) {
				conditions = schemaType.caster.options.refConditions;
			}
		}

		if (validateFunction) {
			schema.path(path).validate(function (value, respond) {
				validateFunction(this, path, refModelName, value, conditions, respond);
			}, message);
		}
	});
};

function executeQuery(query, conditions, validateValue, respond) {
	for (var fieldName in conditions) {
		query.where(fieldName, conditions[fieldName]);
	}
	query.exec(function (err, count) {
		if (err) {
			return respond(err);
		}
		respond(count === validateValue);
	});
}

function validateId(doc, path, refModelName, value, conditions, respond) {
	if (value === null) {
		return respond(true);
	}
	var refModel = mongoose.model(refModelName);
	var query = refModel.count({_id: value});
	executeQuery(query, conditions, 1, respond);
}

function validateIdArray(doc, path, refModelName, values, conditions, respond) {
	if (values.length === 0) {
		return respond(true);
	}
	var n = 0;
	async.eachSeries(values, function(value, next) {
		validateId(doc, path, refModelName, value, conditions, function(valid) {
			if (!valid) {
				doc.invalidate(path + '.' + n, 'No such ' + refModelName + ' with id "' + value + '".', value);
			}
			n++;
			next();
		});
	}, function() { respond(true); });
}