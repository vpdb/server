import { Serializer, SerializerOptions } from '../common/serializer';
import { Token } from './token';
import { Context } from '../common/types/context';
import { pick } from 'lodash';
import UAParser from 'ua-parser-js';

export class TokenSerializer extends Serializer<Token> {

	protected _reduced(ctx: Context, doc: Token, opts: SerializerOptions): Token {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: Token, opts: SerializerOptions): Token {
		const token = pick(doc, ['id', 'label', 'type', 'provider', 'is_active', 'last_used_at', 'expires_at', 'created_at']) as Token;

		token.scopes = (doc.scopes as any).toObject();

		// parse name for browser string
		const browser = new UAParser(doc.label).getResult();
		if (browser.browser.name && browser.os.name) {
			token.browser = browser;
		}
		return token;
	}

	protected _detailed(ctx: Context, doc: Token, opts: SerializerOptions): Token {
		const token = this._simple(ctx, doc, opts);

		// token
		token.token = doc.token;

		return token;
	}
}