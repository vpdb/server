import { state } from '../state';
import { Context } from '../common/types/context';
import { Serializer, SerializerOptions } from '../common/serializer';
import { ContentAuthor } from './content.author';
import { User } from './user';

export class ContentAuthorSerializer extends Serializer<ContentAuthor> {

	protected _reduced(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: state.serializers.User.reduced(ctx, doc._user as User, opts),
			roles: doc.roles
		} as ContentAuthor;
	}

	protected _simple(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: state.serializers.User.simple(ctx, doc._user as User, opts),
			roles: doc.roles
		} as ContentAuthor;
	}

	protected _detailed(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return undefined;
	}
}