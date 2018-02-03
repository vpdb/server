const _ = require('lodash');
const flavor = require('../modules/flavor');
const Serializer = require('./serializer');
const ReleaseVersionFileSerializer = require('./release.version.file.serializer');

class ReleaseVersionSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const version = _.pick(doc, [ 'version', 'released_at' ]);
		version.files = doc.files.map(versionFile => ReleaseVersionFileSerializer.simple(versionFile, req, opts));
		return version;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const version = this._simple(doc, req, opts);
		_.assign(version, _.pick(doc, [ 'changes', 'counter' ]));
		return version;
	}

	/**
	 * Takes a sorted list of versions and removes files that have a newer
	 * flavor. Also removes empty versions.
	 * @param objects Versions to strip
	 * @param {Request} req
	 * @param {object} opts
	 */
	_strip(objects, req, opts) {
		let i, j;
		let flavorValues, flavorKey;
		const flavorKeys = {};
		for (i = 0; i < objects.length; i++) {
			for (j = 0; j < objects[i].files.length; j++) {

				// if file ids given, ignore flavor logic
				if (_.isArray(opts.fileIds)) {
					if (!_.includes(opts.fileIds, objects[i].files[j].file.id)) {
						objects[i].files[j] = null;
					}

				// otherwise, make sure we include only the latest flavor combination.
				} else {

					// if non-table file, skip
					if (!objects[i].files[j].flavor) {
						continue;
					}

					flavorValues = [];
					for (let key in flavor.values) {
						//noinspection JSUnfilteredForInLoop
						flavorValues.push(objects[i].files[j].flavor[key]);
					}
					flavorKey = flavorValues.join(':');

					// strip if already available
					if (flavorKeys[flavorKey]) {
						objects[i].files[j] = null;
					}
					flavorKeys[flavorKey] = true;
				}
			}
			objects[i].files = _.compact(objects[i].files);

			// remove version if no more files
			if (objects[i].files.length === 0) {
				objects[i] = null;
			}
		}
		return _.compact(objects);
	}

}

module.exports = new ReleaseVersionSerializer();