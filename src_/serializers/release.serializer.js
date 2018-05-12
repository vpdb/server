const _ = require('lodash');
const flavor = require('../../src/releases/release.flavors');
const Serializer = require('../../src/common/serializer');
const GameSerializer = require('./game.serializer');
const FileSerializer = require('../../src/files/file.serializer');
const AuthorSerializer = require('./author.serializer');
const UserSerializer = require('../../src/users/user.serializer');
const TagSerializer = require('./tag.serializer');
const ReleaseVersionSerializer = require('./release.version.serializer');

class ReleaseSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, ReleaseVersionSerializer.simple.bind(ReleaseVersionSerializer), true);
	}

	/** @protected */
	_detailed(doc, req, opts) {
		return this._serialize(doc, req, opts, ReleaseVersionSerializer.detailed.bind(ReleaseVersionSerializer), false,
			['description', 'acknowledgements', 'license', 'modified_at' ]);
	}

	/** @private */
	_serialize(doc, req, opts, versionSerializer, stripVersions, additionalFields) {

		const requestedFields = _.intersection(['description'], (req.query.include_fields || '').split(','));
		additionalFields = additionalFields || [];
		const fields = ['id', 'name', 'created_at', 'released_at', 'rating', ...additionalFields, ...requestedFields];

		// primitive fields
		const release = _.pick(doc, fields);

		release.metrics = doc.metrics.toObject();
		release.counter = doc.counter.toObject();

		// game
		if (this._populated(doc, '_game')) {
			release.game = GameSerializer.reduced(doc._game, req, opts);
		}

		// tags
		if (this._populated(doc, '_tags')) {
			release.tags = doc._tags.map(tag => TagSerializer.simple(tag, req, opts));
		}

		// links
		if (_.isArray(doc.links)) {
			release.links = doc.links.map(link => _.pick(link, ['label', 'url']));
		} else {
			release.links = [];
		}

		// creator
		if (this._populated(doc, '_created_by')) {
			release.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}

		// authors
		if (this._populated(doc, 'authors._user')) {
			release.authors = doc.authors.map(author => AuthorSerializer.reduced(author, req, opts));
		}

		// versions
		release.versions = doc.versions
			.map(version => versionSerializer(version, req, opts))
			.sort(this._sortByDate('released_at'));

		if (stripVersions && this._populated(doc, 'versions.files._file')) {
			release.versions = ReleaseVersionSerializer._strip(release.versions, req, opts);
		}

		// thumb
		if (opts.thumbFlavor || opts.thumbFormat) {
			release.thumb = this.findThumb(doc.versions, req, opts);
		}

		// star
		if (opts.starredReleaseIds) {
			release.starred = _.includes(opts.starredReleaseIds, doc._id.toString());
		}
		if (!_.isUndefined(opts.starred)) {
			release.starred = opts.starred;
		}

		return release;
	}


	/**
	 * Returns the thumb object for the given options provided by the user.
	 *
	 * Basically it looks at thumbFlavor and thumbFormat and tries to return
	 * the best match.
	 * @param {Document[]} versions Version documents
	 * @param req
	 * @param {{ thumbFlavor:string, thumbFormat:string, fullThumbData:boolean }} opts thumbFlavor: "orientation:fs,lighting:day", thumbFormat: variation name or "original"
	 * @private
	 * @returns {{image: *, flavor: *}}
	 */
	findThumb(versions, req, opts) {

		opts.thumbFormat = opts.thumbFormat || 'original';

		/** @type {{ lighting:string, orientation:string }} */
		const flavorDefaults = flavor.defaultThumb();
		/** @type {{ lighting:string, orientation:string }} */
		const flavorParams = (opts.thumbFlavor || '').split(',').map(f => f.split(':')).reduce((a, v) => _.assign(a, { [v[0]]: v[1]}), {});

		// get all table files
		const files = _.flatten(_.map(versions, 'files')).filter(file => file.flavor);
		// console.log('flavorParams: %j, flavorDefaults: %j', flavorParams, flavorDefaults);

		// assign weights to each file depending on parameters
		/** @type {{ file: {[playfield_image]:{}, [_playfield_image]:{}}, weight:number }[]} */
		const filesByWeight = _.orderBy(files.map(file => {

			/** @type {{ lighting:string, orientation:string }} */
			const fileFlavor = file.flavor.toObject ? file.flavor.toObject() : file.flavor;
			let weight = 0;
			const flavorNames = this._getFlavorNames(opts);
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
		const thumb = this._getFileThumb(bestMatch, req, opts);
		// can be null if invalid thumbFormat was specified
		if (thumb === null) {
			return {
				image: this._getDefaultThumb(bestMatch, req, opts),
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
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} versionFileDoc Table file
	 * @param req
	 * @param {{ fullThumbData: boolean }} opts
	 * @private
	 * @returns {{}|null}
	 */
	_getDefaultThumb(versionFileDoc, req, opts) {

		let playfieldImage = this._populated(versionFileDoc, '_playfield_image')
			? FileSerializer.detailed(versionFileDoc._playfield_image, req, opts)
			: null;
		if (!playfieldImage || !playfieldImage.metadata) {
			return null;
		}
		const thumb = {
			url: playfieldImage.url,
			width: playfieldImage.metadata.size.width,
			height: playfieldImage.metadata.size.height
		};
		if (opts.fullThumbData) {
			thumb.mime_type = playfieldImage.mime_type;
			thumb.bytes = playfieldImage.bytes;
			thumb.file_type = playfieldImage.file_type;
		}
		return thumb;
	}

	/**
	 * Returns all known flavor names sorted by given parameters.
	 * @param opts
	 * @private
	 * @returns {Array}
	 */
	_getFlavorNames(opts) {
		return _.compact(_.uniq([ ...(opts.thumbFlavor || '').split(',').map(f => f.split(':')[0]), 'orientation', 'lighting' ]));
	}
}

module.exports = new ReleaseSerializer();