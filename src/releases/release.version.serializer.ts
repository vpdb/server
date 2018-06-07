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

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/types/context';
import { ReleaseVersion } from './release.version';
import { flavors } from './release.flavors';

export class ReleaseVersionSerializer extends Serializer<ReleaseVersion> {

	protected _reduced(ctx: Context, doc: ReleaseVersion, opts: SerializerOptions): ReleaseVersion {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: ReleaseVersion, opts: SerializerOptions): ReleaseVersion {
		const version = pick(doc, ['version', 'released_at']) as ReleaseVersion;
		version.files = doc.files.map(versionFile => state.serializers.ReleaseVersionFile.simple(ctx, versionFile, opts));
		return version;
	}

	protected _detailed(ctx: Context, doc: ReleaseVersion, opts: SerializerOptions): ReleaseVersion {
		const version = pick(doc, ['version', 'released_at', 'changes']) as ReleaseVersion;
		version.counter = doc.counter;
		version.files = doc.files.map(versionFile => state.serializers.ReleaseVersionFile.detailed(ctx, versionFile, opts));
		return version;
	}

	/**
	 * Takes a sorted list of versions and removes files that have a newer
	 * flavor. Also removes empty versions.
	 *
	 * @param {Context} ctx Koa context
	 * @param {ReleaseVersion[]} versions Versions to strip
	 * @param {SerializerOptions} opts
	 * @return {ReleaseVersion[]}
	 */
	public strip(ctx: Context, versions: ReleaseVersion[], opts: SerializerOptions) {
		let i, j;
		let flavorValues: string[], flavorKey: string;
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
					for (let key in flavors.values) {
						//noinspection JSUnfilteredForInLoop
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