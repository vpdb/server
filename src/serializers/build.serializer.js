const _ = require('lodash');
const Serializer = require('./serializer');

class BuildSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return _.pick(doc, ['id']);
	}

	/** @protected */
	_simple(doc, req, opts) {
		return _.pick(doc, ['id', 'label', 'platform', 'major_version', 'download_url', 'built_at', 'type', 'is_range']);
	}

	_detailed(doc, req, opts) {
		const build = this._simple(doc, req, opts);
		_.assign(build, _.pick(doc, ['support_url', 'description', 'is_active']));
		return build;
	}
}

module.exports = new BuildSerializer();