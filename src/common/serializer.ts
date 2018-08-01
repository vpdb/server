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

import { assign, defaultsDeep, isArray, isObject, pick } from 'lodash';
import { Document, ModeratedDocument, Types } from 'mongoose';

import { FileDocument } from '../files/file.document';
import { ReleaseVersionFileDocument } from '../releases/version/file/release.version.file.document';
import { state } from '../state';
import { Context } from './typings/context';
import { ModelName } from './typings/models';
import { Thumb } from './typings/serializers';

export abstract class Serializer<T extends Document | ModeratedDocument> {

	public abstract readonly references: { [level in SerializerLevel]: SerializerReference[] };

	/**
	 * Returns the reduced version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<T> Serialized object
	 */
	public reduced(ctx: Context, doc: T, opts?: SerializerOptions): T {
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
	public simple(ctx: Context, doc: T, opts?: SerializerOptions): T {
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
	public detailed(ctx: Context, doc: T, opts?: SerializerOptions): T {
		return this.serialize(this._detailed.bind(this), ctx, doc, opts);
	}

	protected abstract _reduced(ctx: Context, doc: T, opts: SerializerOptions): T;

	protected abstract _simple(ctx: Context, doc: T, opts: SerializerOptions): T;

	protected abstract _detailed(ctx: Context, doc: T, opts: SerializerOptions): T;

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
		if (doc.populated && doc.populated(field)) {
			return true;
		}
		const obj = this.getFirstInPath(doc, field);
		return obj && !(obj instanceof Types.ObjectId);
	}

	protected _defaultOpts(opts: SerializerOptions): SerializerOptions {
		return defaultsDeep(opts || {}, {
			includedFields: [],
			excludedFields: [],
			starred: undefined,
			fileIds: null,
			thumbFlavor: null,
			thumbFormat: null,
			fullThumbData: false,
			thumbPerFile: false,
		});
	}

	protected sortByDate<ST>(attr: string): (a: ST, b: ST) => number {
		return (a: ST, b: ST) => {
			const dateA = new Date((a as any)[attr]).getTime();
			const dateB = new Date((b as any)[attr]).getTime();
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
	protected getFileThumb(ctx: Context, versionFile: ReleaseVersionFileDocument, opts: SerializerOptions): Thumb {

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

		const playfieldImage = state.serializers.File.detailed(ctx, versionFile._playfield_image as FileDocument, opts);

		if (opts.thumbFormat === 'original') {
			return assign(pick(playfieldImage, thumbFields), {
				width: playfieldImage.metadata.size.width,
				height: playfieldImage.metadata.size.height,
			}) as Thumb;

		} else if (playfieldImage.variations[opts.thumbFormat]) {
			return pick(playfieldImage.variations[opts.thumbFormat], thumbFields) as Thumb;
		}
		return null;
	}

	private serialize(serializer: (ctx: Context, doc: T, opts?: SerializerOptions) => T, ctx: Context, doc: T, opts: SerializerOptions): T {
		if (!doc) {
			return undefined;
		}
		return this._post(ctx, doc, serializer(ctx, doc, this._defaultOpts(opts)), this._defaultOpts(opts));
	}

	private getFirstInPath(doc: any, path: string): any {
		if (!path) {
			return doc;
		}
		if (!doc) {
			return undefined;
		}
		if (isArray(doc)) {
			return doc.length > 0 ? this.getFirstInPath(doc[0], path) : undefined;
		}
		const field = path.substr(0, path.indexOf('.') > 0 ? path.indexOf('.') : path.length);
		if (isObject(doc[field])) {
			return this.getFirstInPath(doc[field], path.substr((path.indexOf('.') > 0 ? path.indexOf('.') : path.length) + 1));
		}
		return doc[field];
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
		if ((doc as ModeratedDocument).moderation && opts && opts.includedFields && opts.includedFields.includes('moderation')) {
			(object as ModeratedDocument).moderation = state.serializers.Moderation.simple(ctx, (doc as ModeratedDocument).moderation, opts);
		}

		// remove excluded fields
		opts.excludedFields.forEach(field => delete (object as any)[field]);

		return object;
	}
}

export interface SerializerOptions {
	includedFields?: string[];
	excludedFields?: string[];
	/**
	 * If set, the authenticated user has starred the entity. In this case, add
	 * a `starred` property to the body. Check against `undefined` in order to
	 * set to `true` or `false`.
	 */
	starred?: boolean | undefined;
	fileIds?: string[];
	thumbFlavor?: string;
	thumbFormat?: string;
	fullThumbData?: boolean;
	thumbPerFile?: boolean;
	full?: boolean;
	includeProviderId?: string;

	/**
	 * A list of all starred release IDs of the authenticated user.
	 * Used when listing releases in order to assign the `starred` flag.
	 * When used elsewhere, make sure to invalidate the cache on that resource
	 * after starring.
	 */
	starredReleaseIds?: string[];
	fields?: string[];
}

export type SerializerLevel = 'reduced' | 'simple' | 'detailed';

export interface SerializerReference {
	modelName: ModelName;
	path: string;
	level: SerializerLevel;
	idField?: string;
}
