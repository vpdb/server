import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Tag } from './tag';
import { Context } from '../common/types/context';
import { pick } from 'lodash';
import { User } from '../users/user';

export class TagSerializer extends Serializer<Tag> {

	protected _reduced(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		return pick(doc, ['id']) as Tag;
	}

	protected _simple(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		const tag = pick(doc, ['id', 'name', 'description']) as Tag;
		// created_by
		if (this._populated(doc, '_created_by')) {
			tag.created_by = state.serializers.User.reduced(ctx, tag._created_by as User, opts);
		}
		return tag;
	}

	protected _detailed(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		return this._simple(ctx, doc, opts);
	}
}

module.exports = new TagSerializer();