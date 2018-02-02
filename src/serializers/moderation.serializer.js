const _ = require('lodash');
const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');

class ModerationSerializer extends Serializer {

	/** @protected */
	_simple(object, req, opts) {

		if (!object) {
			return undefined;
		}

		// if user is populated that means we should populate the history, otherwise only status is returned
		const includeHistory = _.isArray(object.history) && object.history[0] && object.history[0]._created_by._id;
		const moderation = _.pick(object, ['is_approved', 'is_refused', 'auto_approved']);
		if (includeHistory) {
			moderation.history = object.history.map(h => {
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