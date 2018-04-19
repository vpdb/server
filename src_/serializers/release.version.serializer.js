const _ = require('lodash');
const flavor = require('../modules/flavor');
const Serializer = require('../../src/common/serializer');
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
		const version = _.pick(doc, [ 'version', 'released_at', 'changes' ]);
		version.counter = doc.counter.toObject();
		version.files = doc.files.map(versionFile => ReleaseVersionFileSerializer.detailed(versionFile, req, opts));
		return version;
	}

	/**
	 * Takes a sorted list of versions and removes files that have a newer
	 * flavor. Also removes empty versions.
	 * @param versions Versions to strip
	 * @param {Request} req
	 * @param {object} opts
	 */
	_strip(versions, req, opts) {
		let i, j;
		let flavorValues, flavorKey;
		const flavorKeys = {};
		for (i = 0; i < versions.length; i++) {
			for (j = 0; j < versions[i].files.length; j++) {

				// if file ids given, ignore flavor logic
				if (_.isArray(opts.fileIds)) {
					if (!_.includes(opts.fileIds, versions[i].files[j].file.id)) {
						versions[i].files[j] = null;
					}

				// otherwise, make sure we include only the latest flavor combination.
				} else {

					// if non-table file, skip
					if (!versions[i].files[j].flavor) {
						continue;
					}

					flavorValues = [];
					for (let key in flavor.values) {
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
			versions[i].files = _.compact(versions[i].files);

			// remove version if no more files
			if (versions[i].files.length === 0) {
				versions[i] = null;
			}
		}
		return _.compact(versions);
	}

}

module.exports = new ReleaseVersionSerializer();