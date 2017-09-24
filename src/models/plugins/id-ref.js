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

const _ = require('lodash');
const mongoose = require('mongoose');

module.exports = function(schema, options) {

	options = options || {};
	const fields = options.fields || [];
	const message = options.message || "{PATH} references a non existing ID";

	schema.eachPath(function (path, schemaType) {
		var validateFunction = null;
		var refModelName = null;
		var conditions = {};

		if (fields.length > 0 && !_.includes(fields, path)) {
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
			schema.path(path).validate(function(value, respond) {
				return Promise.try(() => {
					return validateFunction(this, path, refModelName, value, conditions);

				}).nodeify((err, result) => respond(result));


			}, message);
		}
	});
};

function executeQuery(query, conditions, validateValue) {
	for (var fieldName in conditions) {
		query.where(fieldName, conditions[fieldName]);
	}
	return query.exec().then(count => count === validateValue);
}

function validateId(doc, path, refModelName, value, conditions) {
	if (value === null) {
		return Promise.resolve(true);
	}
	const refModel = mongoose.model(refModelName);
	const query = refModel.count({_id: value});
	return executeQuery(query, conditions, 1);
}

function validateIdArray(doc, path, refModelName, values, conditions) {
	if (values.length === 0) {
		return Promise.resolve(true);
	}
	let n = 0;
	return Promise.each(values, value => {
		return validateId(doc, path, refModelName, value, conditions).then(valid => {
			if (!valid) {
				doc.invalidate(path + '.' + n, 'No such ' + refModelName + ' with id "' + value + '".', value);
			}
			n++;
		});
	}).then(() => true);
}