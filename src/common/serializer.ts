import { Document } from 'mongoose';
import { Context, Context } from 'koa';
import { get, isArray, defaultsDeep, assign, pick } from 'lodash';
import { SerializerOptions } from './types/serializer';

export class Serializer<T> {

	/**
	 * Returns the reduced version of the object.
	 *
	 * @param {T} doc Retrieved MongoDB object
	 * @param {Application.Context} ctx Koa context
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	reduced(ctx: Context, doc: T, opts?: SerializerOptions) {
		return this.__serialize(this._reduced.bind(this), doc, ctx, opts);
	}

	/**
	 * Returns the simple version of the object.
	 *
	 * @param {T} doc Retrieved MongoDB object
	 * @param {Application.Context} ctx Koa context
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	simple(ctx:Context, doc:T, opts?: SerializerOptions) {
		return this.__serialize(this._simple.bind(this), doc, ctx, opts);
	}

	/**
	 * Returns the detailed version of the object.
	 *
	 * @param {T} doc Retrieved MongoDB object
	 * @param {Application.Context} ctx Koa context
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	detailed(ctx:Context, doc:T, opts?: SerializerOptions) {
		return this.__serialize(this._detailed.bind(this), doc, ctx, opts);
	}

	/** @private **/
	__serialize(serializer, doc, ctx, opts: SerializerOptions) {
		if (!doc) {
			return undefined;
		}
		if (!doc._id) {
			throw new Error('Must be document, given: ' + JSON.stringify(doc));
		}
		return this._post(doc, serializer(doc, ctx, this._defaultOpts(opts)), ctx, this._defaultOpts(opts));
	}

	/**
	 * Updates serialized object with additional data, common for all detail
	 * levels and types.
	 *
	 * @private
	 */
	_post(doc, object, ctx, opts: SerializerOptions) {

		if (!object) {
			return object;
		}

		// handle moderation field
		const ModerationSerializer = require('../../src_/serializers/moderation.serializer');
		object.moderation = ModerationSerializer._simple(doc.moderation, ctx, opts);

		// remove excluded fields
		opts.excludedFields.forEach(field => delete object[field]);

		return object;
	}

	/**
	 * Returns the reduced version of the object.
	 *
	 * This is only the fallthrough, don't call directly.
	 * @protected
	 */
	_reduced(doc, ctx, opts: SerializerOptions) {
		return this.simple(doc, ctx, opts);
	}

	/**
	 * Returns the simple version of the object.
	 *
	 * This is only the fallthrough, don't call directly.
	 * @protected
	 */
	_simple(doc:T, ctx:Context, opts: SerializerOptions) {
		return {};
	}

	/**
	 * Returns the detailed version of the object.
	 *
	 * This is only the fallthrough, don't call directly.
	 * @protected
	 */
	_detailed(doc, ctx, opts: SerializerOptions) {
		return this.simple(doc, ctx, opts);
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
	 * @protected
	 */
	_populated(doc: Document, field: string) {
		if (doc.populated(field)) {
			return true;
		}
		let obj = get(doc, field);
		if (isArray(obj) && obj.length > 0) {
			obj = obj[0];
		}
		return obj && obj._id;
	}

	/** @protected */
	_defaultOpts(opts: SerializerOptions): SerializerOptions {
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

	/** @protected */
	_sortByDate(attr) {
		return (a, b) => {
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
	_getFileThumb(versionFile, ctx, opts: SerializerOptions) {

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

		const FileSerializer = require('../../src_/serializers/file.serializer');
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
