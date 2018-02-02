const _ = require('lodash');
const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');

class ModerationSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {

		if (!doc) {
			return undefined;
		}

		// if user is populated that means we should populate the history, otherwise only status is returned
		const includeHistory = _.isArray(doc.history) && doc.history[0] && doc.history[0]._created_by._id;
		const moderation = _.pick(doc, ['is_approved', 'is_refused', 'auto_approved']);
		if (includeHistory) {
			moderation.history = doc.history.map(h => {
				return {
					event: h.event,
					created_at: h.created_at,
					created_by: UserSerializer.reduced(h._created_by, req, opts)
				};
			});
		}
		return moderation;
	}
}

module.exports = new ModerationSerializer();