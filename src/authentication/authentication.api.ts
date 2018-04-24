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

import { uniq } from 'lodash';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { logger } from '../common/logger';
import { ApiError } from '../common/api.error';
import { UserUtil } from '../users/user.util';
import { User } from '../users/user.type';
import { config } from '../common/settings';
import { welcomeOAuth } from '../common/mailer';

export class AuthenticationApi extends Api {

	authenticate(ctx: Context) {

	}

	/**
	 * Updates or creates a new user. This is executed when we have a successful
	 * authentication via one of the enabled OAuth2 strategies. It basically:
	 *
	 *  - checks if a user with a given ID of a given provider is already in the
	 *    database
	 *  - if that's the case, updates the user's profile with received data
	 *  - if not but an email address matches, update the profile
	 *  - otherwise create a new user.
	 *
	 *  Note however that if profile data is incomplete, callback will fail.
	 *
	 * @param {string} strategy Name of the strategy (e.g. "GitHub", "IPBoard")
	 * @param {string} [providerName] For IPBoard we can have multiple configurations, (e.g. "Gameex", "VP*", ...)
	 * @returns {function} "Verify Callback" function that is passed to passport
	 * @see http://passportjs.org/guide/oauth/
	 */
	verifyCallbackOAuth(strategy: string, providerName?: string) {

		const provider = providerName || strategy;
		const logtag = providerName ? strategy + ':' + providerName : strategy;

		return (req: { ctx: Context }, accessToken: string, refreshToken: string, profile: any, callback: Function) => { // accessToken and refreshToken are ignored
			(async () => {
				const ctx = req.ctx;
				try {

					const emails = this.getEmailsFromProfile(ctx, provider, logtag, profile);
					await this.removePendingUsers(ctx, emails);
					const otherUsers = await this.findOtherUsers(ctx, provider, profile.id, emails);
					const oauthUser = await this.identifyOAuthUser(ctx, otherUsers, provider, profile.id, emails);

					// if user found, update and return.
					let user:User;
					if (oauthUser) {
						user = await this.updateOAuthUser(ctx, oauthUser, provider, profile, emails);

					// otherwise, create new user.
					} else {
						user = await this.createOAuthUser(ctx, provider, profile, emails);
					}
					return callback(null, user);

				} catch (err) {

					if (err.constructor && err.constructor.name === 'ApiError') {
						callback(err);

					} else if (err.errors && err.constructor && err.constructor.name === 'MongooseError') {
						callback(new ApiError('User validations failed. See below for details.').validationErrors(err.errors).warn(), 422);

					/* istanbul ignore next: we always wrap errors in Err. */
					} else {
						logger.error(err.stack);
						callback(new ApiError(err, 'Error during authentication.').log());
					}
				}
			})();
		};
	}

	private getEmailsFromProfile(ctx: Context, provider: string, logtag: string, profile: any): string[] {
		if (!profile) {
			logger.warn('[passport|%s] No profile data received.', logtag);
			throw new ApiError('No profile received from %s.', logtag);
		}
		if (!_.isArray(profile.emails) || !profile.emails.length) {
			logger.warn('[passport|%s] Profile data does not contain any email address: %s', logtag, JSON.stringify(profile));
			throw new ApiError('Received profile from %s does not contain any email address.', logtag);
		}
		if (!profile.id) {
			logger.warn('[passport|%s] Profile data does not contain any user ID: %s', logtag, JSON.stringify(profile));
			throw new ApiError('Received profile from %s does not contain user id.', logtag);
		}

		// exclude login with different account at same provider
		if (ctx.state.user && ctx.state.user.providers && ctx.state.user.providers[provider] && ctx.state.user.providers[provider].id !== profile.id) {
			throw new ApiError('Profile at %s is already linked to ID %s', provider, ctx.state.user.providers[provider].id).status(400);
		}

		const emails = profile.emails.filter((e: { value: string }) => !!e).map((e: { value: string }) => e.value);
		if (emails.length === 0) {
			throw new ApiError('Emails must contain at least one value.').status(400);
		}

		return emails;
	}

	/**
	 * There might be "pending_registration" account(s) that match the received email addresses.
	 * in this case, we delete the account(s).
	 *
	 * Note that "pending_update" accounts are dealt with when they are confirmed.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string[]} emails Pending users with this email are removed
	 * @returns {Promise<void>}
	 */
	private async removePendingUsers(ctx:Context, emails:string[]) {
		//
		const pendingUsers = await ctx.models.User.find({
			email: { $in: emails },
			'email_status.code': 'pending_registration'
		});
		for (let user of pendingUsers) {
			logger.warn('[passport] Deleting local user %s with pending registration (match by [ %s ]).', user.toString(), emails.join(', '));
			await user.remove();
		}
	}

	/**
	 * Find users that match either a confirmed email or provider ID we
	 * explicitly don't go after user.email, because if it's confirmed it's in
	 * user.validated_emails.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider to look for ID
	 * @param {string} profileId Provider ID to look for
	 * @param {string[]} emails Emails to look for
	 * @returns {Promise<User[]>}
	 */
	private async findOtherUsers(ctx:Context, provider:string, profileId:string, emails:string[]):Promise<User[]> {
		const query = {
			$or: [
				{ ['providers.' + provider + '.id']: profileId },
				{ emails: { $in: emails } },           // emails from other providers
				{ validated_emails: { $in: emails } }  // emails the user manually validated during sign-up or email change
			]
		};
		logger.info('[passport] Checking for existing user: %s', JSON.stringify(query));
		return await ctx.models.User.find(query).exec();
	}

	private async identifyOAuthUser(ctx:Context, otherUsers:User[], provider:string, profileId:string, emails:string[]): Promise<User|null> {

		// if user is logged, it means we'll link the profile to the existing user.
		if (ctx.state.user) {

			// but we might need to merge first (and fail if no auto-merge possible)
			const explanation = `The email address we've received from the OAuth provider you've just linked to your account to was already in our database.`;
			for (let otherUser of otherUsers) {
				await UserUtil.mergeUsers(ctx, ctx.state.user, otherUser, explanation);
			}
			return ctx.state.user;

		} else {

			// no user match means new user
			if (otherUsers.length === 0) {
				return null;
			}

			// if only one user matched, it'll be updated
			if (otherUsers.length === 1) {
				return otherUsers[0];

			} else {
				// otherwise, try to merge.
				// this can be more than 2 even, e.g. if three local accounts were registered and the oauth profile contains all of them emails
				logger.info('[passport] Got %s matches for user: [ %s ] with %s ID %s and emails [ %s ].',
					otherUsers.length, otherUsers.map(u => u.id).join(', '), provider, profileId, emails.join(', '));

				const explanation = `The email address we've received from the OAuth provider you've just logged was already in our database. This can happen when you change the email address at the provider's to one you've already used at VPDB under a different account.`;
				return await UserUtil.tryMergeUsers(ctx, otherUsers, explanation);
			}
		}
	}

	private async updateOAuthUser(ctx:Context, authUser:User, provider:string, profile:any, emails:string[]):Promise<User> {

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').auth_track(true, { email: authUser.email });
		}
		if (!authUser.providers || !authUser.providers[provider]) {
			authUser.providers = authUser.providers || {};
			authUser.providers[provider] = {
				id: String(profile.id),
				name: this.getNameFromProfile(profile),
				emails: emails,
				created_at: new Date(),
				modified_at: new Date(),
				profile: profile._json
			};
			ctx.models.LogUser.success(ctx, authUser, 'authenticate', {
				provider: provider,
				profile: profile._json
			});
			logger.info('[passport] Adding profile from %s to user.', provider, emails[0]);

		} else {
			authUser.providers[provider].id = String(profile.id);
			authUser.providers[provider].emails = emails;
			authUser.providers[provider].name = this.getNameFromProfile(profile);
			authUser.providers[provider].modified_at = new Date();
			authUser.providers[provider].profile = profile._json;
			ctx.models.LogUser.success(ctx, authUser, 'authenticate', { provider: provider });
			logger.info('[passport] Returning user %s', emails[0]);
		}

		// update profile data on separate field
		authUser.emails = uniq([authUser.email, ...authUser.emails, ...emails]);

		// optional data
		if (!authUser.thumb && profile.photos && profile.photos.length > 0) {
			authUser.thumb = profile.photos[0].value;
		}

		// save and return
		return await authUser.save();
	}

	private async createOAuthUser(ctx:Context, provider:string, profile:any, emails:string[]):Promise<User> {
		// compute username
		let name:string;
		if (!profile.displayName && !profile.username) {
			logger.warn('[passport] Profile data does contain neither display name nor username: %s', JSON.stringify(profile));
			name = profile.emails[0].value.substr(0, profile.emails[0].value.indexOf('@'));
		} else {
			name = profile.displayName || profile.username;
		}
		name = exports.removeDiacritics(name).replace(/[^0-9a-z ]+/gi, '');

		// check if username doesn't conflict
		let newUser: User;
		const dupeNameUser = await ctx.models.User.findOne({ name: name }).exec();
		if (dupeNameUser) {
			name += Math.floor(Math.random() * 1000);
		}
		newUser = {
			is_local: false,
			name: name,
			email: emails[0],
			providers: {
				[provider]: {
					id: String(profile.id),
					name: this.getNameFromProfile(profile),
					emails: emails,
					created_at: new Date(),
					modified_at: new Date(),
					profile: profile._json
				}
			}
		} as User;
		// optional data
		if (profile.photos && profile.photos.length > 0) {
			newUser.thumb = profile.photos[0].value;
		}

		newUser.providers[provider].profile = profile._json; // save original data to separate field
		newUser.emails = _.uniq(emails);

		logger.info('[passport] Creating new user.');

		newUser = await UserUtil.createUser(ctx, newUser, false);

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').signup_track({ email: newUser.email });
		}

		ctx.models.LogUser.success(ctx, newUser, 'registration', {
			provider: provider,
			email: newUser.email
		});
		logger.info('[passport] New user <%s> created.', newUser.email);
		await welcomeOAuth(newUser);

		return newUser;
	}

	private getNameFromProfile(profile: any) {
		return profile.displayName
			|| profile.username
			|| (profile.name ? profile.name.givenName || profile.name.familyName : '')
			|| profile.emails[0].value.substr(0, profile.emails[0].value.indexOf('@'));
	}
}