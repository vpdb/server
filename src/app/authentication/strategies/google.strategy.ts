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
import { GetTokenResponse } from 'google-auth-library/build/src/auth/oauth2client';

import { ApiError } from '../../common/api.error';
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
		let r: GetTokenResponse;
		try {
			r = await this.client.getToken(code);
		} catch (err) {
			logger.error(ctx.state, '[GoogleStrategy] Error retrieving token: %s', err.message);
			throw new ApiError('Error retrieving token from Google.').status(400);
		}
		this.client.setCredentials(r.tokens);
		let res: any;
		try {
			res = await this.client.request({ url: 'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos' });
		} catch (err) {
			logger.error(ctx.state, '[GoogleStrategy] Error retrieving user profile: %s', err.message);
			throw new ApiError('Error retrieving user email from Google.').status(400);
		}
		return res.data;
	}

	/**
	 * Normalizes the Google profile.
	 *
	 * @see https://developers.google.com/people/api/rest/v1/people/get
	 * @param profile
	 * @return {OAuthProfile}
	 */
	protected normalizeProfile(profile: any): OAuthProfile {
		const name = this.findPrimary(profile.names);
		const photo = this.findPrimary(profile.photos);
		const resourceName = profile.resourceName.split('/');
		const normalizedProfile: OAuthProfile = {
			provider: this.name,
			id: resourceName[1],
			emails: profile.emailAddresses.map((a: any) => ({
				value: a.value,
				type: a.metadata && a.metadata.primary ? 'primary' : 'unknown',
			})),
			displayName: name ? name.displayName : undefined,
			_json: profile,
		};
		if (name) {
			normalizedProfile.name = name;
		}
		if (photo) {
			normalizedProfile.photos = [ { value: photo.url }];
		}
		return normalizedProfile;
	}

	private findPrimary(items: Array<{ metadata?: { primary: boolean } }>): any {
		const item = items.find((n: any) => n.metadata && n.metadata.primary);
		if (!item && items.length > 0) {
			return items[0];
		}
		return item;
	}
}
