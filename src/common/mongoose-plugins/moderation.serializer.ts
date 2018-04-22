import { Context } from 'koa';
import { isArray, pick } from 'lodash';
import { User } from '../../users/user.type';
import { ModerationData } from './moderate.type';
import { Serializer, SerializerOptions } from '../serializer';

class ModerationSerializer extends Serializer<ModerationData> {

	protected _detailed(ctx: Context, doc: ModerationData, opts: SerializerOptions): ModerationData {
		return undefined;
	}

	protected _reduced(ctx: Context, doc: ModerationData, opts: SerializerOptions): ModerationData {
		return undefined;
	}

	protected _simple(ctx: Context, doc: ModerationData, opts: SerializerOptions): ModerationData {
		if (!doc) {
			return undefined;
		}
		// if user is populated that means we should populate the history, otherwise only status is returned
		const includeHistory = isArray(doc.history) && doc.history[0] && (doc.history[0]._created_by as User)._id;
		const moderationData:ModerationData = pick(doc, ['is_approved', 'is_refused', 'auto_approved']) as ModerationData;
		if (includeHistory) {
			moderationData.history = doc.history.map(h => {
				return {
					event: h.event,
					created_at: h.created_at,
					created_by: ctx.serializers.User.reduced(ctx, h._created_by as User, opts) as User
				};
			});
		}
		return moderationData;
	}
}

module.exports = new ModerationSerializer();