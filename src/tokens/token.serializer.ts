/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

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