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

import Axios, { AxiosInstance } from 'axios';
import randomstring from 'randomstring';

import { config } from '../../common/settings';
import { Context } from '../../common/types/context';
import { Strategy } from './strategy';
import { stringify } from 'querystring';
import { OAuthProfile } from '../authentication.api';

/**
 * GitHub authentication strategy.
 *
 * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#web-application-flow
 */
export class GitHubStrategy extends Strategy {

	protected name = 'github';
	protected providerName: string = null;

	private readonly redirectUri: string;
	private readonly client: AxiosInstance = Axios.create({ baseURL: 'https://github.com' });
	private readonly apiClient: AxiosInstance = Axios.create({ baseURL: 'https://api.github.com' });

	constructor(redirectUri: string) {
		super();
		this.redirectUri = redirectUri;
	}

	protected getAuthUrl(): string {
		const state = randomstring.generate(16);
		return 'https://github.com/login/oauth/authorize?' + stringify({
			client_id: config.vpdb.passport.github.clientID,
			redirect_uri: this.redirectUri,
			scope: 'user:email',
			state: state
		});
	}

	protected async getProfile(ctx: Context): Promise<any> {
		const code = ctx.query.code;
		const state = ctx.query.state;
		let res = await this.client.post('/login/oauth/access_token', {
			client_id: config.vpdb.passport.github.clientID,
			client_secret: config.vpdb.passport.github.clientSecret,
			code: code,
			redirect_uri: this.redirectUri,
			state: state
		});
		const token = res.data.access_token;
		const type = res.data.token_type;

		// get profile
		res = await this.apiClient.get('/user', { headers: { 'Authorization': `${type} ${token}` } });
		const profile = res.data;

		// get emails
		res = await this.apiClient.get('/user/emails', { headers: { 'Authorization': `${type} ${token}` } });
		profile.emails = (res.data as GitHubEmail[])
			.filter(email => email.verified)
			.map(email => { return { value: email.email, type: 'unknown' } });

		return profile;
	}

	/**
	 * Normalizes the GitHub profile.
	 *
	 * @see https://developer.github.com/v3/users/#get-the-authenticated-user
	 * @param profile
	 * @return {OAuthProfile}
	 */
	protected normalizeProfile(profile: any): OAuthProfile {
		const normalizedProfile: OAuthProfile = {
			provider: this.name,
			id: profile.id,
			emails: profile.emails,
			username: profile.login,
			displayName: profile.name,
			_json: profile
		};
		if (profile.avatar_url) {
			normalizedProfile.photos = [{ value: profile.avatar_url }]
		}
		return normalizedProfile;
	}
}

interface GitHubEmail {
	email: string;
	verified: boolean;
	primary: boolean;
	visibility: string;
}