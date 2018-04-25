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

import { Document } from 'mongoose';
import { get, isArray, defaultsDeep, assign, pick } from 'lodash';
import { Context } from './types/context';
import { Moderated } from './mongoose-plugins/moderate.type';
import { ReleaseVersionFile } from '../releases/release.version.file.type';

export abstract class Serializer<T extends Document | Moderated> {

	protected abstract _reduced(ctx: Context, doc: T, opts: SerializerOptions): T;

	protected abstract _simple(ctx: Context, doc: T, opts: SerializerOptions): T;

	protected abstract _detailed(ctx: Context, doc: T, opts: SerializerOptions): T;

	/**
	 * Returns the reduced version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<T> Serialized object
	 */
	reduced(ctx: Context, doc: T, opts?: SerializerOptions): T {
		return this.serialize(this._reduced.bind(this), ctx, doc, opts);
	}

	/**
	 * Returns the simple version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<T> Serialized object
	 */
	simple(ctx: Context, doc: T, opts?: SerializerOptions): T {
		return this.serialize(this._simple.bind(this), ctx, doc, opts);
	}

	/**
	 * Returns the detailed version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<T> Serialized object
	 */
	detailed(ctx: Context, doc: T, opts?: SerializerOptions): T {
		return this.serialize(this._detailed.bind(this), ctx, doc, opts);
	}

	/** @private **/
	private serialize(serializer: (ctx: Context, doc: T, opts?: SerializerOptions) => T, ctx: Context, doc: T, opts: SerializerOptions): T {
		if (!doc) {
			return undefined;
		}
		return this._post(ctx, doc, serializer(ctx, doc, this._defaultOpts(opts)), this._defaultOpts(opts));
	}

	/**
	 * Updates serialized object with additional data, common for all detail
	 * levels and types.
	 */
	private _post(ctx: Context, doc: T, object: T, opts: SerializerOptions): T {
		if (!object) {
			return object;
		}

		// handle moderation field
		if ((doc as Moderated).moderation) {
			const ModerationSerializer = require('./mongoose-plugins/moderation.serializer');
			(object as Moderated).moderation = ModerationSerializer._simple((doc as Moderated).moderation, ctx, opts);
		}

		// remove excluded fields
		opts.excludedFields.forEach(field => delete (object as any)[field]);

		return object;
	}

	/**
	 * Checks if a field is populated.
	 *
	 * Note that this doesn't work for nested paths where fields are arrays,
	 * e.g. check for 'files._file' doesn't work in the "versions" serializer
	 * (but 'versions.files._file' from the root works).
	 *
	 * @param doc Document to check
	 * @param field Field to check
	 * @returns {boolean}
	 */
	protected _populated(doc: Document, field: string) {
		if (doc.populated(field)) {
			return true;
		}
		let obj = get(doc, field);
		if (isArray(obj) && obj.length > 0) {
			obj = obj[0];
		}
		return obj && obj._id;
	}

	protected _defaultOpts(opts: SerializerOptions): SerializerOptions {
		return defaultsDeep(opts || {}, {
			includedFields: [],
			excludedFields: [],
			starred: undefined,
			fileIds: [],
			thumbFlavor: null,
			thumbFormat: null,
			fullThumbData: false,
			thumbPerFile: false
		});
	}

	protected _sortByDate(attr: string) {
		return (a: { [key: string]: number }, b: { [key: string]: number }) => {
			const dateA = new Date(a[attr]).getTime();
			const dateB = new Date(b[attr]).getTime();
			if (dateA < dateB) {
				return 1;
			}
			if (dateA > dateB) {
				return -1;
			}
			return 0;
		};
	}

	/**
	 * Returns playfield thumb for a given release file.
	 * Can return null if playfield is not populated or thumbFormat is invalid or not specified.
	 *
	 * @param {Document} versionFile Version file
	 * @param {Context} ctx
	 * @param {{ fullThumbData:boolean, thumbFormat:string }} opts thumbFormat is the variation or "original" if the full link is desired.
	 * @protected
	 * @returns {{}|null}
	 */
	protected _getFileThumb(ctx: Context, versionFile: ReleaseVersionFile, opts: SerializerOptions) {

		if (!opts.thumbFormat) {
			return undefined;
		}

		if (!this._populated(versionFile, '_playfield_image')) {
			return undefined;
		}

		let thumbFields = ['url', 'width', 'height', 'is_protected'];
		if (opts.fullThumbData) {
			thumbFields = [...thumbFields, 'mime_type', 'bytes', 'file_type'];
		}

		const FileSerializer = require('../files/file.serializer');
		const playfieldImage = FileSerializer.detailed(versionFile._playfield_image, ctx, opts);

		if (opts.thumbFormat === 'original') {
			return assign(pick(playfieldImage, thumbFields), {
				width: playfieldImage.metadata.size.width,
				height: playfieldImage.metadata.size.height
			});

		} else if (playfieldImage.variations[opts.thumbFormat]) {
			return pick(playfieldImage.variations[opts.thumbFormat], thumbFields);
		}
		return null;
	}
}

export interface SerializerOptions {
	includedFields?: string[],
	excludedFields?: string[],
	starred?: boolean | undefined,
	fileIds?: string[],
	thumbFlavor?: string
	thumbFormat?: string,
	fullThumbData?: boolean,
	thumbPerFile?: boolean,
	includeProviderId?: string
}