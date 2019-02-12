/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

/* istanbul ignore file */
import { OAuth2Client } from 'google-auth-library';

import { logger } from '../../common/logger';
import { config } from '../../common/settings';
import { Context } from '../../common/typings/context';
import { OAuthProfile } from '../authentication.api';
import { Strategy } from './strategy';

export class GoogleStrategy extends Strategy {

	protected name = 'google';
	protected providerName: string = null;

	private readonly client: OAuth2Client;

	constructor(redirectUri: string) {
		super();
		this.client = new OAuth2Client(
			config.vpdb.passport.google.clientID,
			config.vpdb.passport.google.clientSecret,
			redirectUri,
		);
		logger.info(null, '[GoogleStrategy] Instantiated with redirection URL %s', redirectUri);
	}

	protected getAuthUrl(): string {
		return this.client.generateAuthUrl({
			access_type: 'offline',
			scope: ['profile', 'email'],
		});
	}

	protected async getProfile(ctx: Context): Promise<any> {
		const code = ctx.query.code;
		const r = await this.client.getToken(code);
		this.client.setCredentials(r.tokens);
		const res = await this.client.request({ url: 'https://www.googleapis.com/plus/v1/people/me' });
		return res.data;
	}

	/**
	 * Normalizes the Google+ profile.
	 *
	 * @see https://developers.google.com/+/web/api/rest/latest/people#resource
	 * @param profile
	 * @return {OAuthProfile}
	 */
	protected normalizeProfile(profile: any): OAuthProfile {
		const normalizedProfile: OAuthProfile = {
			provider: this.name,
			id: profile.id,
			emails: profile.emails,
			displayName: profile.displayName,
			_json: profile,
		};
		if (profile.name) {
			normalizedProfile.name = {
				familyName: profile.name.familyName,
				givenName: profile.name.givenName,
				middleName: profile.name.middleName,
			};
		}
		if (profile.image) {
			normalizedProfile.photos = [ { value: profile.image.url }];
		}
		return normalizedProfile;
	}
}
