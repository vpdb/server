/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { default as mongoose, Document, Query, Schema } from 'mongoose';

export function idReferenceValidatorPlugin(schema: Schema, options: IdReferenceValidatorOpts = {}) {

	options = options || {};
	const fields = options.fields || [];
	const message = options.message || '{PATH} references a non existing ID';

	schema.eachPath((path, schemaType: any) => {
		let validateFunction: Function = null;
		let refModelName: string = null;
		let conditions = {};

		if (fields.length > 0 && !fields.includes(path)) {
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
			schema.path(path).validate(async function (value: any) {
				return validateFunction(this, path, refModelName, value, conditions);
			}, message);
		}
	});
}

async function executeQuery<T>(query: Query<T>, conditions: string[], validateValue: any) {
	for (let fieldName in conditions) {
		query.where(fieldName, conditions[fieldName]);
	}
	const count = await query.exec();
	return count === validateValue;
}

async function validateId(doc: Document, path: string, refModelName: string, value: any, conditions: string[]) {
	if (value === null) {
		return true;
	}
	const refModel = mongoose.model(refModelName);
	const query = refModel.count({ _id: value });
	return executeQuery(query, conditions, 1);
}

async function validateIdArray(doc: Document, path: string, refModelName: string, values: any[], conditions: string[]) {
	if (values.length === 0) {
		return true;
	}
	let n = 0;
	for (let value of values) {
		const valid = await validateId(doc, path, refModelName, value, conditions);
		if (!valid) {
			doc.invalidate(path + '.' + n, 'No such ' + refModelName + ' with id "' + value + '".', value);
		}
		n++;
	}
	return true;
}

export interface IdReferenceValidatorOpts {
	fields?: string[];
	message?: string;
}