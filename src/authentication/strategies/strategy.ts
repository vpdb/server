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
import { AuthenticationApi, OAuthProfile } from '../authentication.api';
import { Context } from '../../common/types/context';
import { logger } from '../../common/logger';
import { ApiError } from '../../common/api.error';

export abstract class Strategy extends AuthenticationApi {

	/**
	 * Name of the strategy, used as provider name if not specified further.
	 */
	protected abstract name: string;

	/**
	 * Provider name for multiple sites per strategy.
	 */
	protected abstract providerName: string | null;

	/**
	 * Sends the user to the provider in order to authenticate.
	 *
	 * @see GET /v1/redirect/:provider
	 * @param {Context} ctx Koa context
	 */
	public async redirectToProvider(ctx: Context) {
		ctx.redirect(this.getAuthUrl());
	}

	/**
	 * Where the redirection from the provider lands.
	 *
	 * @see GET /auth/:provider
	 * @param {Context} ctx Koa context coming from redirection, i.e. it should contain the access code or an error in the query.
	 */
	public async authenticateOAuth(ctx: Context): Promise<boolean> {
		if (!ctx.query.code) {
			throw new ApiError('Must set `code` URL parameter in order to authenticate.').status(400);
		}
		const profile = await this.getProfile(ctx);
		const user = await this.verifyCallbackOAuth(ctx, this.name, this.providerName, this.normalizeProfile(profile));
		logger.info('[Strategy.authenticate] Successfully authenticated with user <%s>.', user.email);

		return await this.authenticateUser(ctx, user, 'oauth');
	}

	/**
	 * Returns the provider URL the user is redirected to in order to authenticate.
	 * @return {string} Auth URL at provider
	 */
	protected abstract getAuthUrl(): string;

	/**
	 * Returns the profile from the provider.
	 * @param {Context} ctx Koa context coming from redirection, i.e. it should contain the access code or an error in the query.
	 * @return {Promise<any>} Raw profile retrieved from provider
	 */
	protected abstract async getProfile(ctx: Context): Promise<any>;

	/**
	 * Normalizes the raw profile received.
	 * @param profile Raw profile
	 * @return {OAuthProfile} Normalized profile
	 */
	protected abstract normalizeProfile(profile: any): OAuthProfile;
}