const _ = require('lodash');
const flavor = require('../modules/flavor');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const AuthorSerializer = require('./author.serializer');
const ReleaseVersionSerializer = require('./release.version.serializer');

class ReleaseSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, ReleaseVersionSerializer.simple.bind(ReleaseVersionSerializer), true);
	}

	/** @protected */
	_detailed(doc, req, opts) {
		return this._serialize(doc, req, opts, ReleaseVersionSerializer.detailed.bind(ReleaseVersionSerializer), false);
	}

	/** @private */
	_serialize(doc, req, opts, versionSerializer, stripVersions) {
		// primitive fields
		const release = _.pick(doc, ['id', 'name', 'created_at', 'released_at', 'counter']);

		// game
		release.game = GameSerializer.reduced(doc._game, req, opts);

		// authors
		release.authors = doc.authors.map(author => AuthorSerializer.reduced(author, req, opts));

		// versions
		release.versions = doc.versions
			.map(version => ReleaseVersionSerializer.simple(version, req, opts))
			.sort(this._sortByDate('released_at'));

		if (stripVersions) {
			release.versions = ReleaseVersionSerializer._strip(release.versions, req, opts);
		}

		// thumb
		release.thumb = this._findThumb(doc.versions, opts);

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
	 * @param versions
	 * @param {{ thumbFlavor:string, thumbFormat:string, fullThumbData:boolean }} opts thumbFlavor: "orientation:fs,lighting:day", thumbFormat: variation name or "original"
	 * @private
	 * @returns {{image: *, flavor: *}}
	 */
	_findThumb(versions, opts) {

		opts.thumbFormat = opts.thumbFormat || 'original';

		/** @type {{ lighting:string, orientation:string }} */
		const flavorDefaults = flavor.defaultThumb();
		/** @type {{ lighting:string, orientation:string }} */
		const flavorParams = (opts.thumbFlavor || '').split(',').map(f => f.split(':')).reduce((a, v) => _.assign(a, { [v[0]]: v[1]}), {});

		// get all table files
		const files = _.flatten(_.map(versions, 'files')).filter(file => file.flavor);
		console.log(_.flatten(_.map(versions, 'files')));
		console.log('Number of versions = %s', versions.length);
		console.log('Number of files = %s', files.length);

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
		const thumb = this._getFileThumb(bestMatch, opts);
		// can be null if invalid thumbFormat was specified
		if (thumb === null) {
			return {
				image: this._getDefaultThumb(bestMatch, opts),
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
	 * @param {{ [playfield_image]:{}, [_playfield_image]:{} }} file Table file
	 * @param {{ fullThumbData: boolean }} opts
	 * @private
	 * @returns {{}|null}
	 */
	_getDefaultThumb(file, opts) {

		let playfieldImage = this._getPlayfieldImage(file);
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
		return _.uniq([ ...(opts.thumbFlavor || '').split(',').map(f => f.split(':')[0]), 'orientation', 'lighting' ]);
	}
}

module.exports = new ReleaseSerializer();