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

import { assign, isArray, uniq } from 'lodash';

import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { scope } from '../common/scope';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { LogUserUtil } from '../log-user/log.user.util';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { UserUtil } from '../users/user.util';
import { AuthenticationUtil } from './authentication.util';

export class AuthenticationApi extends Api {

	/**
	 * Authenticates a user with local credentials or a login token.
	 *
	 * @see POST /v1/authenticate
	 * @param {Context} ctx
	 * @returns {Promise<boolean>}
	 */
	public async authenticate(ctx: Context) {
		const ipAddress = this.getIpAddress(ctx);
		const backoffNumDelay = config.vpdb.loginBackoff.keep;
		const backoffDelay = config.vpdb.loginBackoff.delay;
		const backoffNumKey = 'auth_delay_num:' + ipAddress;
		const backoffLockKey = 'auth_delay_time:' + ipAddress;

		let how: 'password' | 'token';
		let authenticatedUser: UserDocument;
		try {

			// check if there's a back-off delay
			const ttl = await state.redis.ttl(backoffLockKey);
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
			await this.authenticateUser(ctx, authenticatedUser, how);

			// if logged and no "keep" is set, expire lock
			if (!backoffNumDelay) {
				await state.redis.del(backoffNumKey);
			}

		} catch (err) {
			// increase number of consecutively failed attempts
			const num: number = await state.redis.incr(backoffNumKey);

			// check how log to wait
			const wait = backoffDelay[Math.min(num, backoffDelay.length) - 1];
			logger.info(ctx.state, '[AuthenticationApi.authenticate] Increasing back-off time to %s for try number %d.', wait, num);

			// if there's a wait, set the lock and expire it to wait time
			if (wait > 0) {
				await state.redis.set(backoffLockKey, '1');
				await state.redis.expire(backoffLockKey, wait);
			}
			// if this is the first failure and "keep" is set, start the count-down (usually 24h)
			/* istanbul ignore if: Tests break if we keep the backoff delay. */
			if (num === 1 && backoffNumDelay) {
				await state.redis.expire(backoffNumKey, backoffNumDelay);
			}
			throw err;
		}
	}

	/**
	 * Mock-authenticates via OAuth (only enabled when testing).
	 *
	 * @see POST /v1/authenticate/mock
	 * @param {Context} ctx Koa context
	 */
	public async mockOAuth(ctx: Context) {
		const strategy = ctx.request.body.provider as string;
		const profile = ctx.request.body.profile as OAuthProfile;
		const user = await this.verifyCallbackOAuth(ctx, strategy, null, profile);
		logger.info(ctx.state, '[AuthenticationApi.mockOAuth] Successfully authenticated with user <%s>.', user.email);

		return this.authenticateUser(ctx, user, 'oauth');
	}

	/**
	 * Makes sure the user is active and returns token and profile on success.
	 *
	 * @param {Context} ctx Koa context
	 * @param {UserDocument} authenticatedUser Authenticated user
	 * @param {"password" | "token" | "oauth"} how Auth method
	 */
	protected async authenticateUser(ctx: Context, authenticatedUser: UserDocument, how: 'password' | 'token' | 'oauth'): Promise<boolean> {

		await this.assertUserIsActive(ctx, authenticatedUser);

		// generate token and return.
		const now = new Date();
		const expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
		const token = AuthenticationUtil.generateApiToken(authenticatedUser, now, how !== 'password' && how !== 'oauth');

		await LogUserUtil.success(ctx, authenticatedUser, 'authenticate', { provider: 'local', how });
		logger.info(ctx.state, '[AuthenticationApi.authenticate] User <%s> successfully authenticated using %s.', authenticatedUser.email, how);
		/* istanbul ignore if */
		if (process.env.SQREEN_ENABLED) {
			require('sqreen').auth_track(true, { email: authenticatedUser.email });
		}
		const acls = await UserUtil.getACLs(authenticatedUser);
		const response = {
			token,
			expires,
			user: assign(state.serializers.User.detailed(ctx, authenticatedUser), acls),
		};

		/* istanbul ignore if */
		if (process.env.SQREEN_ENABLED) {
			require('sqreen').auth_track(true, { email: authenticatedUser.email });
		}
		return this.success(ctx, response, 200);
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
	 * @param {Context} ctx Koa context
	 * @param {string} strategy Name of the strategy (e.g. "github", "google", "ips")
	 * @param {string | null} providerName For IPS we can have multiple configurations, (e.g. "gameex", "vpu", ...)
	 * @param profile Profile retrieved from the provider
	 * @return {Promise<UserDocument>} Authenticated user
	 */
	protected async verifyCallbackOAuth(ctx: Context, strategy: string, providerName: string | null, profile: OAuthProfile): Promise<UserDocument> {
		const provider = providerName || strategy;
		const logTag = providerName ? strategy + ':' + providerName : strategy;

		// retrieve emails from profile or fail if there are none
		const emails = this.getEmailsFromProfile(ctx, provider, logTag, profile);

		// remove non-confirmed users with matching email
		await this.removePendingUsers(ctx, emails);

		// find users who match confirmed email or provider id
		const otherUsers = await this.findOtherUsers(ctx, provider, profile.id, emails);

		// boil down found users to one
		const foundUser = await this.identifyUser(ctx, otherUsers, provider, profile.id, emails);

		return foundUser ?
			// if user found, update and return.
			this.updateOAuthUser(ctx, foundUser, provider, profile, emails) :
			// otherwise, create new user.
			this.createOAuthUser(ctx, provider, profile, emails);
	}

	/**
	 * Tries to authenticate locally with user/password.
	 *
	 * @param {Context} ctx Koa context
	 * @throws {ApiError} If credentials provided but authentication failed.
	 * @return {UserDocument | null} User if found and authenticated, null if no credentials provided.
	 */
	private async authenticateLocally(ctx: Context): Promise<UserDocument> {
		// try to authenticate with user/pass
		if (!ctx.request.body.username || !ctx.request.body.password) {
			return null;
		}
		const localUser = await state.models.User.findOne({ username: ctx.request.body.username }).exec();
		if (localUser && localUser.authenticate(ctx.request.body.password)) {
			// all good, return.
			return localUser;
		}
		// log if there was a user
		if (localUser) {
			await LogUserUtil.failure(ctx, localUser, 'authenticate', { provider: 'local' }, null, 'Invalid password.');
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
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
	 * @return {Promise<UserDocument>} Authenticated user
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
		const token = await state.models.Token.findOne({ token: ctx.request.body.token }).populate('_created_by').exec();
		// fail if not found
		if (!token) {
			// todo fix antiBruteForce = true;
			throw new ApiError('Invalid token.').status(401);
		}
		// fail if invalid type
		if (token.type !== 'personal') {
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
				require('sqreen').auth_track(false, { email: (token._created_by as UserDocument).email });
			}
			throw new ApiError('Cannot use token of type "%s" for authentication (must be of type "personal").', token.type).status(401);
		}
		// fail if not login token
		if (!scope.isIdentical(token.scopes, ['login'])) {
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
				require('sqreen').auth_track(false, { email: (token._created_by as UserDocument).email });
			}
			throw new ApiError('Token to exchange for JWT must exclusively be "login" ([ "' + token.scopes.join('", "') + '" ] given).').status(401);
		}
		// fail if token expired
		if (token.expires_at.getTime() < Date.now()) {
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
				require('sqreen').auth_track(false, { email: (token._created_by as UserDocument).email });
			}
			throw new ApiError('Token has expired.').status(401);
		}
		// fail if token inactive
		if (!token.is_active) {
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
				require('sqreen').auth_track(false, { email: (token._created_by as UserDocument).email });
			}
			throw new ApiError('Token is inactive.').status(401);
		}
		await token.update({ last_used_at: new Date() });
		return token._created_by as UserDocument;
	}

	/**
	 * Asserts that the user is active, otherwise an exception is thrown.
	 *
	 * @param {Context} ctx Koa context
	 * @param {UserDocument} user User to test
	 * @throws {ApiError} When user is inactive
	 * @return {Promise<void>}
	 */
	private async assertUserIsActive(ctx: Context, user: UserDocument): Promise<void> {
		if (!user.is_active) {
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
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
	 * Retrieves email addresses from the received Passport profile. If there
	 * are none, an exception in thrown.
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider ID
	 * @param {string} logTag For Logging purpose
	 * @param profile Received profile
	 * @return {string[]} Email addresses
	 */
	private getEmailsFromProfile(ctx: Context, provider: string, logTag: string, profile: OAuthProfile): string[] {
		if (!profile) {
			logger.warn(ctx.state, '[AuthenticationApi.getEmailsFromProfile|%s] No profile data received.', logTag);
			throw new ApiError('No profile received from %s.', logTag);
		}
		if (!isArray(profile.emails) || !profile.emails.length) {
			logger.warn(ctx.state, '[AuthenticationApi.getEmailsFromProfile|%s] Profile data does not contain any email address: %s', logTag, JSON.stringify(profile));
			throw new ApiError('Received profile from %s does not contain any email address.', logTag);
		}
		if (!profile.id) {
			logger.warn(ctx.state, '[AuthenticationApi.getEmailsFromProfile|%s] Profile data does not contain any user ID: %s', logTag, JSON.stringify(profile));
			throw new ApiError('Received profile from %s does not contain user id.', logTag);
		}

		// exclude login with different account at same provider
		if (ctx.state.user && ctx.state.user.providers && ctx.state.user.providers[provider] && ctx.state.user.providers[provider].id !== profile.id) {
			throw new ApiError('Profile at %s is already linked to ID %s', provider, ctx.state.user.providers[provider].id).status(400);
		}

		const emails = profile.emails.filter((e: { value: string }) => e && e.value).map((e: { value: string }) => e.value);
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
		const pendingUsers = await state.models.User.find({
			email: { $in: emails },
			'email_status.code': 'pending_registration',
		});
		for (const user of pendingUsers) {
			logger.warn(ctx.state, '[AuthenticationApi.removePendingUsers] Deleting local user %s with pending registration (match by [ %s ]).', user.toString(), emails.join(', '));
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
	 * @returns {Promise<UserDocument[]>}
	 */
	private async findOtherUsers(ctx: Context, provider: string, profileId: string, emails: string[]): Promise<UserDocument[]> {
		const query = {
			$or: [
				{ ['providers.' + provider + '.id']: profileId },
				{ emails: { $in: emails } },           // emails from other providers
				{ validated_emails: { $in: emails } },  // emails the user manually validated during sign-up or email change
			],
		};
		logger.info(ctx.state, '[AuthenticationApi.findOtherUsers] Checking for existing user: %s', JSON.stringify(query));
		return state.models.User.find(query).exec();
	}

	/**
	 * Boils down all found users to one (or none, if none found).
	 *
	 *  - If the user is logged, merges the received profile with logged user.
	 *  - Otherwise tries to merge all matched users
	 *  - If no user matched, returns `null`.
	 *
	 * @param {Context} ctx Koa context
	 * @param {UserDocument[]} otherUsers Users matching either confirmed email or provider ID with the received profile
	 * @param {string} provider Provider ID
	 * @param {string} profileId Received profile ID
	 * @param {string[]} emails Received profile emails
	 * @return {Promise<UserDocument | null>} Merged user or null if no other users provided and not logged.
	 */
	private async identifyUser(ctx: Context, otherUsers: UserDocument[], provider: string, profileId: string, emails: string[]): Promise<UserDocument | null> {

		// if user is logged, it means we'll link the profile to the existing user.
		if (ctx.state.user) {

			// but we might need to merge first (and fail if no auto-merge possible)
			const explanation = `The email address we've received from the OAuth provider you've just linked to your account to was already in our database.`;
			for (const otherUser of otherUsers) {
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
				logger.info(ctx.state, '[AuthenticationApi.identifyUser] Got %s matches for user: [ %s ] with %s ID %s and emails [ %s ].',
					otherUsers.length, otherUsers.map(u => u.id).join(', '), provider, profileId, emails.join(', '));

				const explanation = `The email address we've received from the OAuth provider you've just logged was already in our database. This can happen when you change the email address at the provider's to one you've already used at VPDB under a different account.`;
				return UserUtil.tryMergeUsers(ctx, otherUsers, explanation);
			}
		}
	}

	/**
	 * Updates an existing user with an OAuth profile.
	 *
	 * @param {Context} ctx Koa context
	 * @param {UserDocument} user User to update
	 * @param {string} provider Provider ID
	 * @param profile Profile
	 * @param {string[]} emails Emails collected from profile
	 * @return {Promise<UserDocument>} Updated user
	 */
	private async updateOAuthUser(ctx: Context, user: UserDocument, provider: string, profile: OAuthProfile, emails: string[]): Promise<UserDocument> {

		/* istanbul ignore if */
		if (process.env.SQREEN_ENABLED) {
			require('sqreen').auth_track(true, { email: user.email });
		}
		if (!user.providers || !user.providers[provider]) {
			user.providers = user.providers || {};
			user.providers[provider] = {
				id: String(profile.id),
				name: this.getNameFromProfile(profile),
				emails,
				created_at: new Date(),
				modified_at: new Date(),
				profile: profile._json,
			};
			await LogUserUtil.success(ctx, user, 'authenticate', {
				provider,
				profile: profile._json,
			});
			logger.info(ctx.state, '[AuthenticationApi.updateOAuthUser] Adding profile from %s to user.', provider, emails[0]);

		} else {
			user.providers[provider].id = String(profile.id);
			user.providers[provider].emails = emails;
			user.providers[provider].name = this.getNameFromProfile(profile);
			user.providers[provider].modified_at = new Date();
			user.providers[provider].profile = profile._json;
			await LogUserUtil.success(ctx, user, 'authenticate', { provider });
			logger.info(ctx.state, '[AuthenticationApi.updateOAuthUser] Returning user %s', emails[0]);
		}

		// update profile data on separate field
		user.emails = uniq([user.email, ...user.emails, ...emails]);

		// optional data
		/* istanbul ignore next: Don't give a crap */
		if (!user.thumb && profile.photos && profile.photos.length > 0) {
			user.thumb = profile.photos[0].value;
		}

		// save and return
		return user.save();
	}

	/**
	 * Creates a new user from a received OAuth profile.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} provider Provider ID
	 * @param profile Received profile
	 * @param {string[]} emails Emails collected from profile
	 * @return {Promise<UserDocument>} Created user
	 */
	private async createOAuthUser(ctx: Context, provider: string, profile: OAuthProfile, emails: string[]): Promise<UserDocument> {
		// compute username
		let name: string;
		if (!profile.displayName && !profile.username) {
			logger.warn(ctx.state, '[AuthenticationApi.createOAuthUser] Profile data does contain neither display name nor username: %s', JSON.stringify(profile));
			name = profile.emails[0].value.substr(0, profile.emails[0].value.indexOf('@'));
		} else {
			name = profile.displayName || profile.username;
		}
		name = UserUtil.removeDiacritics(name).replace(/[^0-9a-z ]+/gi, '');

		// check if username doesn't conflict
		let newUser: UserDocument;
		const dupeNameUser = await state.models.User.findOne({ name }).exec();
		if (dupeNameUser) {
			name += Math.floor(Math.random() * 1000);
		}
		const now = new Date();
		newUser = {
			is_local: false,
			name,
			email: emails[0],
			providers: {
				[provider]: {
					id: String(profile.id),
					name: this.getNameFromProfile(profile),
					emails,
					created_at: now,
					modified_at: now,
					profile: profile._json,
				},
			},
		} as UserDocument;
		// optional data
		if (profile.photos && profile.photos.length > 0) {
			newUser.thumb = profile.photos[0].value;
		}

		newUser.providers[provider].profile = profile._json; // save original data to separate field
		newUser.emails = uniq(emails);

		logger.info(ctx.state, '[AuthenticationApi.createOAuthUser] Creating new user.');

		newUser = await UserUtil.createUser(ctx, newUser, false);

		/* istanbul ignore if */
		if (process.env.SQREEN_ENABLED) {
			require('sqreen').signup_track({ email: newUser.email });
		}

		await LogUserUtil.success(ctx, newUser, 'registration', {
			provider,
			email: newUser.email,
		});
		logger.info(ctx.state, '[AuthenticationApi.createOAuthUser] New user <%s> created.', newUser.email);
		await mailer.welcomeOAuth(ctx.state, newUser);

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

/**
 * The normalized user profile fetched from the OAuth provider.
 *
 * @see https://tools.ietf.org/html/draft-smarr-vcarddav-portable-contacts-00
 */
export interface OAuthProfile {
	/**
	 * The provider with which the user authenticated (facebook, twitter, etc.).
	 */
	provider: string;

	/**
	 * A unique identifier for the user, as generated by the service provider.
	 */
	id: string;

	/**
	 * The name login name of the user
	 */
	username?: string;

	/**
	 * The name of this user, suitable for display.
	 */
	displayName?: string;

	name?: {
		/**
		 * The family name of this user, or "last name" in most Western languages.
		 */
		familyName?: string;
		/**
		 * The given name of this user, or "first name" in most Western languages.
		 */
		givenName?: string;

		/**
		 * The middle name of this user.
		 */
		middleName?: string;
	};

	emails: Array<{
		/**
		 * The actual email address.
		 */
		value: string;

		/**
		 * The type of email address (home, work, etc.).
		 */
		type: string;
	}>;

	photos?: Array<{
		/**
		 * The URL of the image.
		 */
		value: string;
	}>;

	/**
	 * The original JSON profile as fetched from the provider.
	 */
	_json: { [key: string]: any };
}
