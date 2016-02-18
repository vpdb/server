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

/**
 * Plugin that enables releases to be filtered by nested attributes.
 *
 * @param schema
 * @param options
 */
module.exports = function(schema, options) {

	/**
	 * Returns an aggregation pipeline that filters releases by nested conditions.
	 *
	 * @param {Array} query Original, non-nested query
	 * @param {Array} filter Array of nested conditions, e.g. [ { "versions.files.flavor.lightning": "night" } ]
	 * @param {number} [sortBy] Object defining the sort order
	 * @param {{defaultPerPage: Number, maxPerPage: Number, page: Number, perPage: Number}} [pagination] Pagination object
	 */
	schema.statics.getAggregationPipeline = function(query, filter, sortBy, pagination) {

		let q = makeQuery(query.concat(filter));
		let f = makeQuery(filter);

		let group1 = {};
		let group2 = {};
		let project1 = {};
		let project2 = {};

		_.each(options.releaseFields, function(val, field) {
			if (field != 'versions') {
				group1[field] = '$' + field;
				group2[field] = '$' + field;
				project1[field] = '$_id.' + field;
				project2[field] = '$_id.' + field;
			}
		});
		project1.versions = { };

		_.each(options.versionFields, function(val, field) {
			if (field != 'files') {
				group1['version_' + field] = '$versions.' + field;
				project1.versions[field] = '$_id.version_' + field;
			}
		});

		let pipe = [ { $match: q } ];
		if (sortBy) {
			pipe.push({ $sort: sortBy });
		}

		if (pagination) {
			pipe.push({ $skip: (pagination.page * pagination.perPage) - pagination.perPage });
			pipe.push({ $limit: pagination.perPage });
		}

		pipe = pipe.concat([

			{ $unwind: '$versions'},
			{ $unwind: '$versions.files'},
			{ $match: f },
			{ $group: { _id: _.extend(group1, {
				_id: '$_id',
				versionId: '$versions._id'
			}),
				files: { $push: '$versions.files' }
			} },
			{ $project: _.extend(project1, {
				_id: '$_id._id',
				versions: _.extend(project1.versions, {
					_id: '$_id.versionId',
					files: '$files'
				})
			}) },
			{ $group: { _id: _.extend(group2, {
				_id: '$_id'
			}),
				versions: { $push: '$versions' }
			} },
			{ $project: _.extend(project2, {
				_id: '$_id._id',
				versions: '$versions'
			}) }
		]);
		return pipe;
	};
};

function makeQuery(query) {
	if (query.length === 0) {
		return {};
	} else if (query.length === 1) {
		return query[0];
	} else {
		return { $and: query };
	}
}
