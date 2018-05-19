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

import { Schema } from 'mongoose';

export function sortableTitlePlugin(schema: Schema, opts: SortableTitleOptions = {}) {

	opts.src = opts.src || 'title';
	opts.dest = opts.dest || 'title_sortable';

	schema.pre('save', function (this: any, next: Function) {
		if (this[opts.src]) {
			this[opts.dest] = this[opts.src].replace(/^((the|a|an)\s+)(.+)$/i, '$3, $2');
		}
		next();
	});
}

export interface SortableTitleOptions {
	src?: string;
	dest?: string;
}