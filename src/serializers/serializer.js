const _ = require('lodash');

class Serializer {

	constructor() {
		/**
		 * Smallest level of detail
		 * @type {string}
		 */
		this.REDUCED = 'reduced';
		/**
		 * Normal level of detail
		 * @type {string}
		 */
		this.SIMPLE = 'simple';
		/**
		 * Most detailed level
		 * @type {string}
		 */
		this.DETAILED = 'detailed';
	}

	/**
	 * Serializes the object to be returned by the API.
	 *
	 * @param {'reduced'|'simple'|'detailed'} detailLevel
	 * @param {object} object Retrieved MongoDB object
	 * @param {Request} req Request object
	 * @param {{ includeModeration:boolean, starred:boolean|undefined, fileIds:string[], thumbFlavor:string, thumbFormat:string, fullThumbData:boolean, thumbPerFile:boolean }} [opts] Additional options for serialization
	 * @return {object} Serialized object
	 */
	serialize(detailLevel, object, req, opts) {

		object = object.toObj ? object.toObj() : object;
		opts = _.defaultsDeep(opts || {}, {
			includeModeration: false,
			starred: undefined,
			fileIds: [],
			thumbFlavor: null,
			thumbFormat: null,
			fullThumbData: false,
			thumbPerFile: false
		});

		// opts.flavor = opts.flavor || {};
		// opts.fields = opts.fields || [];

		switch (detailLevel) {
			case this.REDUCED:
				return this.reduced(object, req, opts);

			case this.SIMPLE:
				return this.simple(object, req, opts);

			case this.DETAILED:
				return this.detailed(object, req, opts);
		}
	}

	reduced(object, req, opts) {
		return this.simple(object, req, opts);
	}

	simple(object, req, opts) {
		return {};
	}

	detailed(object, req, opts) {
		return this.simple(object, req, opts);
	}

	sortByDate(attr) {
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
		}
	}

	/**
	 * Returns playfield thumb for a given release file.
	 * Can return null if playfield is not populated or thumbFormat is invalid or not specified.
	 *
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table
	 * @param {{ fullThumbData:boolean, thumbFormat:string }} opts thumbFormat is the variation or "original" if the full link is desired.
	 * @returns {{}|null}
	 */
	getFileThumb(file, opts) {

		let thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
		if (opts.fullThumbData) {
			thumbFields = [...thumbFields, 'mime_type', 'bytes', 'file_type'];
		}

		if (!opts.thumbFormat) {
			return null;
		}

		const playfieldImage = this.getPlayfieldImage(file);

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
	 * Returns playfield thumb for a given release file.
	 * Can return null if playfield is not populated or thumbFormat is invalid or not specified.
	 *
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table
	 * @param {{ fullThumbData:boolean, thumbFormat:string }} opts thumbFormat is the variation or "original" if the full link is desired.
	 * @returns {{}|null}
	 */
	getFileThumb(file, opts) {

		let thumbFields = [ 'url', 'width', 'height', 'is_protected' ];
		if (opts.fullThumbData) {
			thumbFields = [...thumbFields, 'mime_type', 'bytes', 'file_type'];
		}

		if (!opts.thumbFormat) {
			return null;
		}

		const playfieldImage = this.getPlayfieldImage(file);

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
	 * @returns {{}|ObjectId|null}
	 */
	getPlayfieldImage(file) {
		const playfieldImage = file.playfield_image || file._playfield_image;
		if (!playfieldImage) {
			return null;
		}
		return playfieldImage.toObj ? playfieldImage.toObj() : playfieldImage;
	}

}

module.exports = Serializer;