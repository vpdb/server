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

import { uniq, isArray, assign } from 'lodash';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { Context } from '../common/types/context';
import { logger } from '../common/logger';
import { config } from '../common/settings';
import { welcomeOAuth } from '../common/mailer';
import { User } from '../users/user';
import { UserUtil } from '../users/user.util';
import { LogUserUtil } from '../log-user/log.user.util';
import { scope } from '../common/scope';
import { AuthenticationUtil } from './authentication.util';

export class AuthenticationApi extends Api {

	/**
	 * Authenticates a user with local credentials or a login token.
	 *
	 * @see /v1/authenticate
	 * @param {Context} ctx
	 * @returns {Promise<boolean>}
	 */
	public async authenticate(ctx: Context) {
		const ipAddress = ctx.ip || ctx.request.get('x-forwarded-for') || '0.0.0.0';
		const backoffNumDelay = config.vpdb.loginBackoff.keep;
		const backoffDelay = config.vpdb.loginBackoff.delay;
		const backoffNumKey = 'auth_delay_num:' + ipAddress;
		const backoffDelayKey = 'auth_delay_time:' + ipAddress;

		let how: string;
		let authenticatedUser: User;
		try {

			// check if there's a back-off delay
			const ttl = await ctx.redis.ttlAsync(backoffDelayKey);
			if (ttl > 0) {
				throw new ApiError('Too many failed login attempts from %s, blocking for another %s seconds.', ipAddress, ttl)
					.display('Too many failed login attempts from this IP, try again in %s seconds.', ttl)
					.body({ wait: ttl })
					.warn()
					.status(429);
			}

			// try to authenticate locally
			const localUser = await this.authenticateLocally(ctx);
			if (localUser) {
				how = 'password';
				authenticatedUser = localUser;

			} else {
				// try to authenticate
				how = 'token';
				authenticatedUser = await this.authenticateWithToken(ctx);
			}

			// here we're authenticated (but not yet authorized)
			await this.assetUserIsActive(ctx, authenticatedUser);

			// generate token and return.
			const now = new Date();
			const expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
			const token = AuthenticationUtil.generateApiToken(authenticatedUser, now, how !== 'password');

			await LogUserUtil.success(ctx, authenticatedUser, 'authenticate', { provider: 'local', how: how });
			logger.info('[api|user:authenticate] User <%s> successfully authenticated using %s.', authenticatedUser.email, how);
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(true, { email: authenticatedUser.email });
			}
			const acls = await UserUtil.getACLs(authenticatedUser);
			const response = {
				token: token,
				expires: expires,
				user: assign(ctx.serializers.User.detailed(ctx, authenticatedUser), acls)
			};

			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(true, { email: authenticatedUser.email });
			}

			return this.success(ctx, response, 200);

		} catch (err) {
			const num: number = await ctx.redis.incrAsync(backoffNumKey);
			let wait = backoffDelay[Math.min(num, backoffDelay.length) - 1];
			logger.info('[api|user:authenticate] Increasing back-off time to %s for try number %d.', wait, num);
			if (wait > 0) {
				await ctx.redis.setAsync(backoffDelayKey, '1');
				await ctx.redis.expireAsync(backoffDelayKey, wait);
			}
			if (num === 1) {
				await ctx.redis.expireAsync(backoffNumKey, backoffNumDelay);
			}
			throw err;
		}
	}

	/**
	 * Tries to authenticate locally with user/password.
	 *
	 * @param {Context} ctx Koa context
	 * @throws {ApiError} If credentials provided but authentication failed.
	 * @return {User | null} User if found and authenticated, null if no credentials provided.
	 */
	private async authenticateLocally(ctx: Context): Promise<User> {
		// try to authenticate with user/pass
		if (!ctx.request.body.username || !ctx.request.body.password) {
			return null;
		}
		const localUser = await ctx.models.User.findOne({ username: ctx.request.body.username }).exec();
		if (localUser && localUser.authenticate(ctx.request.body.password)) {
			// all good, return.
			return localUser;
		}
		// log if there was a user
		if (localUser) {
			await LogUserUtil.failure(ctx, localUser, 'authenticate', { provider: 'local' }, null, 'Invalid password.');
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { username: ctx.request.body.username });
			}
		} // don't bother logging unknown user names
		throw new ApiError('Authentication denied for user "%s" (%s)', ctx.request.body.username, localUser ? 'password' : 'username')
			.display('Wrong username or password')
			.warn()
			.status(401);
	}

	/**
	 * Tries to authenticate the user with a login token or fails otherwise.
	 *
	 * Note that contrarily to `authenticateLocally()`, this throws also when
	 * no token is found at all.
	 *
	 * @param {Context} ctx Koa context
	 * @return {Promise<User>} Authenticated user
	 * @throws {ApiError} When authentication failed or no login token was provided.
	 */
	private async authenticateWithToken(ctx: Context) {
		// if no token provided, fail fast.
		if (!ctx.request.body.token) {
			throw new ApiError('Ignored incomplete authentication request')
				.display('You must supply a username and password or a token with "login" scope.')
				.warn()
				.status(400);
		}
		// fail if token has incorrect syntax
		if (!/[0-9a-f]{32,}/i.test(ctx.request.body.token)) {
			throw new ApiError('Ignoring auth with invalid token %s', ctx.request.body.token)
				.display('Incorrect login token.')
				.warn()
				.status(400);
		}
		const token = await ctx.models.Token.findOne({ token: ctx.request.body.token }).populate('_created_by').exec();
		// fail if not found
		if (!token) {
			// todo fix antiBruteForce = true;
			throw new ApiError('Invalid token.').status(401);
		}
		// fail if invalid type
		if (token.type !== 'personal') {
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { email: (token._created_by as User).email });
			}
			throw new ApiError('Cannot use token of type "%s" for authentication (must be of type "personal").', token.type).status(401);
		}
		// fail if not login token
		if (!scope.isIdentical(token.scopes, ['login'])) {
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { email: (token._created_by as User).email });
			}
			throw new ApiError('Token to exchange for JWT must exclusively be "login" ([ "' + token.scopes.join('", "') + '" ] given).').status(401);
		}
		// fail if token expired
		if (token.expires_at.getTime() < new Date().getTime()) {
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { email: (token._created_by as User).email });
			}
			throw new ApiError('Token has expired.').status(401);
		}
		// fail if token inactive
		if (!token.is_active) {
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { email: (token._created_by as User).email });
			}
			throw new ApiError('Token is inactive.').status(401);
		}
		await token.update({ last_used_at: new Date() });
		return token._created_by as User;
	}

	/**
	 * Asserts that the user is active, otherwise an exception is thrown.
	 *
	 * @param {Context} ctx Koa context
	 * @param {User} user User to test
	 * @throws {ApiError} When user is inactive
	 * @return {Promise<void>}
	 */
	private async assetUserIsActive(ctx: Context, user: User): Promise<void> {
		if (!user.is_active) {
			if (config.vpdb.services.sqreen.enabled) {
				require('sqreen').auth_track(false, { email: user.email });
			}
			if (user.email_status && user.email_status.code === 'pending_registration') {
				await LogUserUtil.failure(ctx, user, 'authenticate', { provider: 'local' }, null, 'Inactive account due to pending email confirmation.');
				throw new ApiError('User <%s> tried to login with unconfirmed email address.', user.email)
					.display('Your account is inactive until you confirm your email address <%s>. If you did not get an email from <%s>, please contact an administrator.', user.email, config.vpdb.email.sender.email)
					.warn()
					.status(403);

			} else {
				await LogUserUtil.failure(ctx, user, 'authenticate', { provider: 'local' }, null, 'Inactive account.');
				throw new ApiError('User <%s> is disabled, refusing access', user.email)
					.display('Inactive account. Please contact an administrator')
					.warn()
					.status(403);
			}
		}
	}

	/**
	 * Updates or creates a new user. This is executed when we have a successful
	 * authentication via one of the Passport^s OAuth2 strategies. It basically:
	 *
	 *  - checks if a user with a given ID of a given provider is already in the
	 *    database
	 *  - if that's the case, updates the user's profile with received data
	 *  - if not but an email address matches, update the profile
	 *  - clean pending registration profiles
	 *  - merge if multiple uses with the received emails match
	 *  - otherwise create a new user.
	 *
	 * Note that if profile data is incomplete, callback will fail.
	 *
	 * @param {string} strategy Name of the strategy (e.g. "GitHub", "IPBoard")
	 * @param {string} [providerName] For IPBoard we can have multiple configurations, (e.g. "Gameex", "VP*", ...)
	 * @returns {function} "Verify Callback" function that is passed to passport
	 * @see http://passportjs.org/guide/oauth/
	 */
	public verifyCallbackOAuth(strategy: string, providerName?: string) {

		const provider = providerName || strategy;
		const logtag = providerName ? strategy + ':' + providerName : strategy;

		return (req: { ctx: Context }, accessToken: string, refreshToken: string, profile: any, callback: Function) => { // accessToken and refreshToken are ignored

			// passport still uses callbacks (wtf!), so wrap this into an async block:
			(async () => {
				const ctx = req.ctx;
				try {
					// retrieve emails from profile or fail if there are none
					const emails = this.getEmailsFromProfile(ctx, provider, logtag, profile);

					// remove non-confirmed users with matching email
					await this.removePendingUsers(ctx, emails);

					// find users who match confirmed email or provider id
					const otherUsers = await this.findOtherUsers(ctx, provider, profile.id, emails);

					// boil down found users to one
					const foundUser = await this.identifyUser(ctx, otherUsers, provider, profile.id, emails);

					let user: User;
					if (foundUser) {
						// if user found, update and return.
						user = await this.updateOAuthUser(ctx, foundUser, provider, profile, emails);

					} else {
						// otherwise, create new user.
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

	/**
	 * Retrieves email addresses from the received Passport profile. If there
	 * are none, an exception in thrown.
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider ID
	 * @param {string} logtag For Logging purpose
	 * @param profile Received profile
	 * @return {string[]} Email addresses
	 */
	private getEmailsFromProfile(ctx: Context, provider: string, logtag: string, profile: any): string[] {
		if (!profile) {
			logger.warn('[passport|%s] No profile data received.', logtag);
			throw new ApiError('No profile received from %s.', logtag);
		}
		if (!isArray(profile.emails) || !profile.emails.length) {
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
	private async removePendingUsers(ctx: Context, emails: string[]): Promise<void> {
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
	 * explicitly don't go after `user.email`, because if it's confirmed it's in
	 * `user.validated_emails`.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider to look for ID
	 * @param {string} profileId Provider ID to look for
	 * @param {string[]} emails Emails to look for
	 * @returns {Promise<User[]>}
	 */
	private async findOtherUsers(ctx: Context, provider: string, profileId: string, emails: string[]): Promise<User[]> {
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

	/**
	 * Boils down all found users to one (or none, if none found).
	 *
	 *  - If the user is logged, merges the received profile with logged user.
	 *  - Otherwise tries to merge all matched users
	 *  - If no user matched, returns `null`.
	 *
	 * @param {Context} ctx Koa context
	 * @param {User[]} otherUsers Users matching either confirmed email or provider ID with the received profile
	 * @param {string} provider Provider ID
	 * @param {string} profileId Received profile ID
	 * @param {string[]} emails Received profile emails
	 * @return {Promise<User | null>} Merged user or null if no other users provided and not logged.
	 */
	private async identifyUser(ctx: Context, otherUsers: User[], provider: string, profileId: string, emails: string[]): Promise<User | null> {

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

	/**
	 * Updates an existing user with an OAuth profile.
	 *
	 * @param {Context} ctx Koa context
	 * @param {User} user User to update
	 * @param {string} provider Provider ID
	 * @param profile Profile
	 * @param {string[]} emails Emails collected from profile
	 * @return {Promise<User>} Updated user
	 */
	private async updateOAuthUser(ctx: Context, user: User, provider: string, profile: any, emails: string[]): Promise<User> {

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').auth_track(true, { email: user.email });
		}
		if (!user.providers || !user.providers[provider]) {
			user.providers = user.providers || {};
			user.providers[provider] = {
				id: String(profile.id),
				name: this.getNameFromProfile(profile),
				emails: emails,
				created_at: new Date(),
				modified_at: new Date(),
				profile: profile._json
			};
			await LogUserUtil.success(ctx, user, 'authenticate', {
				provider: provider,
				profile: profile._json
			});
			logger.info('[passport] Adding profile from %s to user.', provider, emails[0]);

		} else {
			user.providers[provider].id = String(profile.id);
			user.providers[provider].emails = emails;
			user.providers[provider].name = this.getNameFromProfile(profile);
			user.providers[provider].modified_at = new Date();
			user.providers[provider].profile = profile._json;
			await LogUserUtil.success(ctx, user, 'authenticate', { provider: provider });
			logger.info('[passport] Returning user %s', emails[0]);
		}

		// update profile data on separate field
		user.emails = uniq([user.email, ...user.emails, ...emails]);

		// optional data
		if (!user.thumb && profile.photos && profile.photos.length > 0) {
			user.thumb = profile.photos[0].value;
		}

		// save and return
		return await user.save();
	}

	/**
	 * Creates a new user from a received OAuth profile.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider ID
	 * @param profile Received profile
	 * @param {string[]} emails Emails collected from profile
	 * @return {Promise<User>} Created user
	 */
	private async createOAuthUser(ctx: Context, provider: string, profile: any, emails: string[]): Promise<User> {
		// compute username
		let name: string;
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
		const now = new Date();
		newUser = {
			is_local: false,
			name: name,
			email: emails[0],
			providers: {
				[provider]: {
					id: String(profile.id),
					name: this.getNameFromProfile(profile),
					emails: emails,
					created_at: now,
					modified_at: now,
					profile: profile._json
				}
			}
		} as User;
		// optional data
		if (profile.photos && profile.photos.length > 0) {
			newUser.thumb = profile.photos[0].value;
		}

		newUser.providers[provider].profile = profile._json; // save original data to separate field
		newUser.emails = uniq(emails);

		logger.info('[passport] Creating new user.');

		newUser = await UserUtil.createUser(ctx, newUser, false);

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').signup_track({ email: newUser.email });
		}

		await LogUserUtil.success(ctx, newUser, 'registration', {
			provider: provider,
			email: newUser.email
		});
		logger.info('[passport] New user <%s> created.', newUser.email);
		await welcomeOAuth(newUser);

		return newUser;
	}

	/**
	 * Retrieves the username from the received OAuth profile. Falls back to
	 * email prefix if none found.
	 * @param profile
	 * @return {string}
	 */
	private getNameFromProfile(profile: any) {
		return profile.displayName
			|| profile.username
			|| (profile.name ? profile.name.givenName || profile.name.familyName : '')
			|| profile.emails[0].value.substr(0, profile.emails[0].value.indexOf('@'));
	}
}