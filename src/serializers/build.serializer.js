const _ = require('lodash');
const Serializer = require('./serializer');

class BuildSerializer extends Serializer {

	/** @protected */
	_reduced(object, req, opts) {
		return _.pick(object, ['id']);
	}

	/** @protected */
	_simple(object, req, opts) {
		return _.pick(object, ['id', 'label', 'platform', 'major_version', 'download_url', 'built_at', 'type', 'is_range']);
	}

	_detailed(object, req, opts) {
		const build = this._simple(object, req, opts);
		_.assign(build, _.pick(object, ['support_url', 'description', 'is_active']));
		return build;
	}
}

module.exports = new BuildSerializer();