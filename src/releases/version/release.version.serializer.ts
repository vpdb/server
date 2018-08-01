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

import { compact, includes, isArray, pick } from 'lodash';

import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../../common/serializer';
import { Context } from '../../common/typings/context';
import { state } from '../../state';
import { flavors } from '../release.flavors';
import { ReleaseVersionDocument } from './release.version.document';

/* tslint:disable:member-ordering */
export class ReleaseVersionSerializer extends Serializer<ReleaseVersionDocument> {

	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [
			{ path: 'files', modelName: 'ReleaseVersionFile', level: 'simple' },
		],
		simple: [
			{ path: 'files', modelName: 'ReleaseVersionFile', level: 'simple' },
		],
		detailed: [
			{ path: 'files', modelName: 'ReleaseVersionFile', level: 'detailed' },
		],
	};

	protected _reduced(ctx: Context, doc: ReleaseVersionDocument, opts: SerializerOptions): ReleaseVersionDocument {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: ReleaseVersionDocument, opts: SerializerOptions): ReleaseVersionDocument {
		const version = pick(doc, ['version', 'released_at']) as ReleaseVersionDocument;
		version.files = doc.files.map(versionFile => state.serializers.ReleaseVersionFile.simple(ctx, versionFile, opts));
		return version;
	}

	protected _detailed(ctx: Context, doc: ReleaseVersionDocument, opts: SerializerOptions): ReleaseVersionDocument {
		const version = pick(doc, ['version', 'released_at', 'changes']) as ReleaseVersionDocument;
		version.counter = doc.counter;
		version.files = doc.files.map(versionFile => state.serializers.ReleaseVersionFile.detailed(ctx, versionFile, opts));
		return version;
	}

	/**
	 * Takes a sorted list of versions and removes files that have a newer
	 * flavor. Also removes empty versions.
	 *
	 * @param {Context} ctx Koa context
	 * @param {ReleaseVersionDocument[]} versions Versions to strip
	 * @param {SerializerOptions} opts
	 * @return {ReleaseVersionDocument[]}
	 */
	public strip(ctx: Context, versions: ReleaseVersionDocument[], opts: SerializerOptions) {
		let i: number;
		let j: number;
		let flavorValues: string[];
		let flavorKey: string;
		const flavorKeys: { [key: string]: boolean } = {};
		for (i = 0; i < versions.length; i++) {
			for (j = 0; j < versions[i].files.length; j++) {

				// if file ids given, ignore flavor logic
				if (isArray(opts.fileIds)) {
					if (!includes(opts.fileIds, versions[i].files[j].file.id)) {
						versions[i].files[j] = null;
					}

				// otherwise, make sure we include only the latest flavor combination.
				} else {

					// if non-table file, skip
					if (!versions[i].files[j].flavor) {
						continue;
					}
					flavorValues = [];
					for (const key of Object.keys(flavors.values)) {
						flavorValues.push(versions[i].files[j].flavor[key]);
					}
					flavorKey = flavorValues.join(':');

					// strip if already available
					if (flavorKeys[flavorKey]) {
						versions[i].files[j] = null;
					}
					flavorKeys[flavorKey] = true;
				}
			}
			versions[i].files = compact(versions[i].files);

			// remove version if no more files
			if (versions[i].files.length === 0) {
				versions[i] = null;
			}
		}
		return compact(versions);
	}
}
