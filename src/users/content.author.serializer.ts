import { Serializer, SerializerOptions } from '../common/serializer';
import { ContentAuthor } from './content.author';
import { User } from './user';
import { Context } from '../common/types/context';

export class ContentAuthorSerializer extends Serializer<ContentAuthor> {

	protected _reduced(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: ctx.serializers.User.reduced(ctx, doc._user as User, opts),
			roles: doc.roles
		} as ContentAuthor;
	}

	protected _simple(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: ctx.serializers.User.simple(ctx, doc._user as User, opts),
			roles: doc.roles
		} as ContentAuthor;
	}

	protected _detailed(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return undefined;
	}
}