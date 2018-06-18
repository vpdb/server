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

/* istanbul ignore file */
import Axios, { AxiosInstance, AxiosResponse } from 'axios';
import { parse, stringify } from 'querystring'
import randomString from 'randomstring';

import { config } from '../../common/settings';
import { Context } from '../../common/types/context';
import { ApiError } from '../../common/api.error';
import { OAuthProfile } from '../authentication.api';
import { Strategy } from './strategy';
import { logger } from '../../common/logger';

/**
 * GitHub authentication strategy.
 *
 * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#web-application-flow
 */
export class GitHubStrategy extends Strategy {

	protected name = 'github';
	protected providerName: string = null;

	private readonly redirectUri: string;
	private readonly client: AxiosInstance = Axios.create({ baseURL: 'https://github.com', validateStatus: status => status < 500 });
	private readonly apiClient: AxiosInstance = Axios.create({ baseURL: 'https://api.github.com' });

	constructor(redirectUri: string) {
		super();
		this.redirectUri = redirectUri;
		logger.info('[GitHubStrategy] Instantiated with redirection URL %s', redirectUri);
	}

	protected getAuthUrl(): string {
		const state = randomString.generate(16);
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

		// get access token
		let res = await this.client.post('/login/oauth/access_token', {
			client_id: config.vpdb.passport.github.clientID,
			client_secret: config.vpdb.passport.github.clientSecret,
			code: code,
			redirect_uri: this.redirectUri,
			state: state
		}) as AxiosResponse;

		// handle errors
		if (res.status === 404) {
			throw new ApiError('Invalid client ID or secret when retrieving access token from GitHub.');
		}
		const body = res.headers['content-type'].includes('form-urlencoded') ? parse(res.data) : res.data;
		if (body.error) {
			throw new ApiError('Error authenticating with GitHub: %s', body.error_description || body.error);
		}
		if (!body.access_token || !body.token_type) {
			throw new ApiError('Error retrieving access token from GitHub.');
		}

		// looking good, get profile.
		const token = body.access_token;
		const type = body.token_type;
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