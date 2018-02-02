const _ = require('lodash');

class Serializer {

	/**
	 * Returns the reduced version of the object.
	 *
	 * @param {Document} doc Retrieved MongoDB object
	 * @param {Request} req Request object
	 * @param {{ [includedFields]:string[], [excludedFields]:string[], [starred]:boolean|undefined, [fileIds]:string[], [thumbFlavor]:string, [thumbFormat]:string, [fullThumbData]:boolean, [thumbPerFile]:boolean }} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	reduced(doc, req, opts) {
		return this.__serialize(this._reduced.bind(this), doc, req, opts);
	}

	/**
	 * Returns the simple version of the object.
	 *
	 * @param {Document} doc Retrieved MongoDB object
	 * @param {Request} req Request object
	 * @param {{ [includedFields]:string[], [excludedFields]:string[], [starred]:boolean|undefined, [fileIds]:string[], [thumbFlavor]:string, [thumbFormat]:string, [fullThumbData]:boolean, [thumbPerFile]:boolean }} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	simple(doc, req, opts) {
		return this.__serialize(this._simple.bind(this), doc, req, opts);
	}

	/**
	 * Returns the detailed version of the object.
	 *
	 * @param {Document} doc Retrieved MongoDB object
	 * @param {Request} req Request object
	 * @param {{ [includedFields]:string[], [excludedFields]:string[], [starred]:boolean|undefined, [fileIds]:string[], [thumbFlavor]:string, [thumbFormat]:string, [fullThumbData]:boolean, [thumbPerFile]:boolean }} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	detailed(doc, req, opts) {
		return this.__serialize(this._detailed.bind(this), doc, req, opts);
	}

	/** @private **/
	__serialize(serializer, doc, req, opts) {
		if (!doc) {
			return undefined;
		}
		return this._post(doc, serializer(doc, req, this._defaultOpts(opts)), req, this._defaultOpts(opts));
	}

	/**
	 * Updates serialized object with additional data, common for all detail
	 * levels and types.
	 *
	 * @private
	 */
	_post(doc, object, req, opts) {

		// handle moderation field
		object.moderation = require('./moderation.serializer')._simple(doc.moderation, req, opts);

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
	_reduced(doc, req, opts) {
		return this.simple(doc, req, opts);
	}

	/**
	 * Returns the simple version of the object.
	 *
	 * This is only the fallthrough, don't call directly.
	 * @protected
	 */
	_simple(doc, req, opts) {
		return {};
	}

	/**
	 * Returns the detailed version of the object.
	 *
	 * This is only the fallthrough, don't call directly.
	 * @protected
	 */
	_detailed(doc, req, opts) {
		return this.simple(doc, req, opts);
	}

	/** @protected */
	_defaultOpts(opts) {
		return _.defaultsDeep(opts || {}, {
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
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table
	 * @param {{ fullThumbData:boolean, thumbFormat:string }} opts thumbFormat is the variation or "original" if the full link is desired.
	 * @protected
	 * @returns {{}|null}
	 */
	_getFileThumb(file, opts) {

		let thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
		if (opts.fullThumbData) {
			thumbFields = [...thumbFields, 'mime_type', 'bytes', 'file_type'];
		}

		if (!opts.thumbFormat) {
			return null;
		}

		const playfieldImage = this._getPlayfieldImage(file);

		// if not populated, return null
		if (!playfieldImage || !playfieldImage.metadata) {
			return null;
		}

		if (opts.thumbFormat === 'original') {
			return _.assign(_.pick(playfieldImage, thumbFields), {
				width: playfieldImage.metadata.size.width,
				height: playfieldImage.metadata.size.height
			});

		} else if (playfieldImage.variations[opts.thumbFormat]) {
			return _.pick(playfieldImage.variations[opts.thumbFormat], thumbFields);
		}
		return null;
	}

	/**
	 * Returns the playfield image property from the table file object.
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table file
	 * @protected
	 * @returns {{}|ObjectId|null}
	 */
	_getPlayfieldImage(file) {
		const playfieldImage = file.playfield_image || file._playfield_image;
		if (!playfieldImage) {
			return null;
		}
		return playfieldImage.toObj ? playfieldImage.toObj() : playfieldImage;
	}

}

module.exports = Serializer;