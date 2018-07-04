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

import { assign, flatten, orderBy, compact, uniq, intersection, pick, includes, isArray, isUndefined } from 'lodash';
import { Document } from 'mongoose';

import { state } from '../state';
import { Context } from '../common/typings/context';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Thumb } from '../common/typings/serializers';
import { Release } from './release';
import { ReleaseVersion } from './release.version';
import { ReleaseFileFlavor, ReleaseVersionFile } from './release.version.file';
import { File } from '../files/file';
import { Game } from '../games/game';
import { Tag } from '../tags/tag';
import { User } from '../users/user';
import { flavors } from './release.flavors';
import { FileDocument } from '../files/file.document';

export class ReleaseSerializer extends Serializer<Release> {

	protected _reduced(ctx: Context, doc: Release, opts: SerializerOptions): Release {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: Release, opts: SerializerOptions): Release {
		return this.serializeRelease(ctx, doc, opts, state.serializers.ReleaseVersion.simple.bind(state.serializers.ReleaseVersion), true);
	}

	protected _detailed(ctx: Context, doc: Release, opts: SerializerOptions): Release {
		return this.serializeRelease(ctx, doc, opts, state.serializers.ReleaseVersion.detailed.bind(state.serializers.ReleaseVersion), false,
			['description', 'acknowledgements', 'license', 'modified_at']);
	}

	private serializeRelease(ctx: Context, doc: Release, opts: SerializerOptions,
							 versionSerializer: (ctx: Context, doc: ReleaseVersion, opts: SerializerOptions) => ReleaseVersion,
							 stripVersions: boolean,
							 additionalFields: string[] = []): Release {

		const requestedFields = intersection(['description'], (ctx.query.include_fields || '').split(','));
		additionalFields = additionalFields || [];
		const fields = ['id', 'name', 'created_at', 'released_at', 'rating', ...additionalFields, ...requestedFields];

		// primitive fields
		const release = pick(doc, fields) as Release;

		release.metrics = doc.metrics;
		release.counter = doc.counter;

		// game
		if (this._populated(doc, '_game')) {
			release.game = state.serializers.Game.reduced(ctx, (doc._game as Game), opts);
		}

		// tags
		if (this._populated(doc, '_tags')) {
			release.tags = (doc._tags as Tag[]).map(tag => state.serializers.Tag.simple(ctx, tag, opts));
		}

		// links
		if (isArray(doc.links)) {
			release.links = doc.links.map(link => pick(link, ['label', 'url']));
		} else {
			release.links = [];
		}

		// creator
		if (this._populated(doc, '_created_by')) {
			release.created_by = state.serializers.User.reduced(ctx, doc._created_by as User, opts);
		}

		// authors
		if (this._populated(doc, 'authors._user')) {
			release.authors = doc.authors.map(author => state.serializers.ContentAuthor.reduced(ctx, author, opts));
		}

		// versions
		release.versions = doc.versions
			.map(version => versionSerializer(ctx, version, opts))
			.sort(this.sortByDate('released_at'));

		if (stripVersions && this._populated(doc, 'versions.files._file')) {
			release.versions = state.serializers.ReleaseVersion.strip(ctx, release.versions, opts);
		}

		// thumb
		if (opts.thumbFlavor || opts.thumbFormat) {
			release.thumb = this.findThumb(ctx, doc.versions, opts);
		}

		// star
		if (!isUndefined(opts.starred)) {
			release.starred = opts.starred;
		} else if (opts.starredReleaseIds) {
			release.starred = opts.starredReleaseIds.includes(doc._id.toString());
		}

		return release;
	}

	/**
	 * Returns the thumb object for the given options provided by the user.
	 *
	 * Basically it looks at thumbFlavor and thumbFormat and tries to return
	 * the best match.
	 *
	 * @param {Context} ctx Koa context
	 * @param {ReleaseVersion[]} versions Version documents
	 * @param {SerializerOptions} opts thumbFlavor: "orientation:fs,lighting:day", thumbFormat: variation name or "original"
	 * @return {{image: Thumb, flavor: ReleaseFileFlavor}}
	 */
	public findThumb(ctx: Context, versions: ReleaseVersion[], opts: SerializerOptions) : { image: Thumb, flavor: ReleaseFileFlavor } {

		opts.thumbFormat = opts.thumbFormat || 'original';

		const flavorDefaults = flavors.defaultThumb();
		let flavorParams: { [key:string]:string } = {}; // e.g. { lighting:string, orientation:string }
		if (opts.thumbFlavor) {
			flavorParams  = opts.thumbFlavor
				.split(',')
				.map(f => f.split(':'))
				.reduce((a, v) => assign(a, { [v[0]]: v[1] }), {});
		}

		// get all table files
		const releaseVersionTableFiles = flatten(versions.map(v => v.files))
			.filter(file => FileDocument.getMimeCategory(file._file as File) === 'table');

		// console.log('flavorParams: %j, flavorDefaults: %j', flavorParams, flavorDefaults);

		// assign weights to each file depending on parameters
		const filesByWeight:{ file: ReleaseVersionFile, weight: number }[] = orderBy(releaseVersionTableFiles.map(file => {

			/** @type {{ lighting:string, orientation:string }} */
			const fileFlavor = file.flavor;
			let weight = 0;
			const flavorNames = this.getFlavorNames(opts);
			let p = flavorNames.length + 1;
			flavorNames.forEach(flavorName => {

				// parameter match gets most weight.
				if (fileFlavor[flavorName] === flavorParams[flavorName]) {
					weight += Math.pow(10, p * 3);

					// defaults match gets also weight, but less
				} else if (fileFlavor[flavorName] === flavorDefaults[flavorName]) {
					weight += Math.pow(10, p);
				}
				p--;
			});

			// console.log('%s / %j => %d', opts.thumbFlavor, fileFlavor, weight);
			return {
				file: file,
				weight: weight
			};

		}), ['weight'], ['desc']);

		const bestMatch = filesByWeight[0].file;
		const thumb = this.getFileThumb(ctx, bestMatch, opts);
		// can be null if invalid thumbFormat was specified
		if (thumb === null) {
			return {
				image: this.getDefaultThumb(ctx, bestMatch, opts),
				flavor: bestMatch.flavor
			};
		}
		return thumb ? {
			image: thumb,
			flavor: bestMatch.flavor
		} : undefined;
	}


	/**
	 * Returns the default thumb of a file.
	 *
	 * @param {Context} ctx
	 * @param {ReleaseVersionFile} versionFileDoc
	 * @param {SerializerOptions} opts
	 * @return {Thumb}
	 */
	private getDefaultThumb(ctx:Context, versionFileDoc:ReleaseVersionFile, opts:SerializerOptions): Thumb {

		let playfieldImage = this._populated(versionFileDoc, '_playfield_image')
			? state.serializers.File.detailed(ctx, versionFileDoc._playfield_image as File, opts)
			: null;
		if (!playfieldImage || !playfieldImage.metadata) {
			return null;
		}
		const thumb = {
			url: playfieldImage.url,
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		} as Thumb;
		if (opts.fullThumbData) {
			thumb.mime_type = playfieldImage.mime_type;
			thumb.bytes = playfieldImage.bytes;
			thumb.file_type = playfieldImage.file_type;
		}
		return thumb;
	}

	/**
	 * Returns all known flavor names sorted by given parameters.
	 * @param opts Options
	 * @returns string[]
	 */
	private getFlavorNames(opts: SerializerOptions):string[] {
		const names = (opts.thumbFlavor || '')
			.split(',')
			.map((f: string) => f.split(':')[0]);
		return compact(uniq([...names, 'orientation', 'lighting']));
	}
}