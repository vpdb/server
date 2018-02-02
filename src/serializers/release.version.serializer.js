const _ = require('lodash');
const flavor = require('../modules/flavor');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');
const BuildSerializer = require('./build.serializer');

class ReleaseVersionSerializer extends Serializer {

	simple(object, req, opts) {
		const version = _.pick(object, [ 'version', 'released_at' ]);
		version.files = object.files.map(versionFile => {
			const addThumb = opts.thumbPerFile && opts.thumbFormat;
			return {
				released_at: versionFile.released_at,
				compatibility: versionFile._compatibility.map(build => BuildSerializer.reduced(build, req, opts)),
				file: FileSerializer.simple(versionFile._file, req, opts),
				thumb: addThumb ?  this.getFileThumb(versionFile, opts) : undefined
			};
		});
		return version;
	}

	/**
	 * Takes a sorted list of versions and removes files that have a newer
	 * flavor. Also removes empty versions.
	 * @param objects Versions to strip
	 * @param {Request} req
	 * @param {object} opts
	 */
	strip(objects, req, opts) {
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