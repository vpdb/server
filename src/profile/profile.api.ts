/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

import { assign, extend, pick, uniq, values } from 'lodash';
import randomstring from 'randomstring';

import { state } from '../state';
import { Api } from '../common/api';
import { acl } from '../common/acl';
import { Context } from '../common/types/context';
import { quota } from '../common/quota';
import { logger } from '../common/logger';
import { LogUserUtil } from '../log-user/log.user.util';
import { ApiError, ApiValidationError } from '../common/api.error';
import { User } from '../users/user';
import { emailUpdateConfirmation, welcomeLocal } from '../common/mailer';
import { config } from '../common/settings';
import { realtime } from '../common/realtime';
import { UserUtil } from '../users/user.util';

export class ProfileApi extends Api {

	/**
	 * Returns the current user's profile.
	 *
	 * @see GET /v1/profile
	 * @param ctx Koa context
	 */
	public async view(ctx: Context) {

		const acls = await this.getACLs(ctx.state.user);
		const q = await quota.getCurrent(ctx.state.user);
		return this.success(ctx, assign(state.serializers.User.detailed(ctx, ctx.state.user), acls, { quota: q }), 200);
	}

	/**
	 * Updates the current user's profile.
	 *
	 * @see PATCH /v1/profile
	 * @param ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['name', 'location', 'email', 'preferences', 'channel_config'];

		// api test behavior
		let testMode = process.env.NODE_ENV === 'test';
		let currentUser = ctx.state.user;
		let errors:ApiValidationError[] = [];

		const updatedUser = await state.models.User.findById(currentUser._id).exec();
		if (!updatedUser) {
			throw new ApiError('User not found. Seems be deleted since last login.').status(404);
		}

		// check for dupe name
		if (ctx.request.body.name) {
			const dupeNameUser = await state.models.User.findOne({
				name: ctx.request.body.name,
				id: { $ne: currentUser.id }
			}).exec();
			if (dupeNameUser) {
				throw new ApiError('Validation failed').validationError('name', 'User with this name already exists', ctx.request.body.name);
			}
		}

		// apply new data
		extend(updatedUser, pick(ctx.request.body, updatableFields));

		// CHANGE PASSWORD
		if (ctx.request.body.password && !ctx.request.body.username) {

			// check for current password
			if (!ctx.request.body.current_password) {
				errors.push({
					message: 'You must provide your current password.',
					path: 'current_password'
				});

			} else {
				// change password
				if (updatedUser.authenticate(ctx.request.body.current_password)) {
					updatedUser.password = ctx.request.body.password;
					await LogUserUtil.success(ctx, updatedUser, 'change_password');
				} else {
					errors.push({ message: 'Invalid password.', path: 'current_password' });
					logger.warn('[ProfileApi.update] User <%s> provided wrong current password while changing.', currentUser.email);
				}
			}
		}

		// CREATE LOCAL ACCOUNT
		if (ctx.request.body.username && !currentUser.is_local) {

			if (!ctx.request.body.password) {
				errors.push({ message: 'You must provide your new password.', path: 'password' });

			} else {
				updatedUser.password = ctx.request.body.password;
				updatedUser.username = ctx.request.body.username;
				updatedUser.is_local = true;
				await LogUserUtil.success(ctx, updatedUser, 'create_local_account', { username: ctx.request.body.username });
			}
		}
		if (ctx.request.body.username && currentUser.is_local && ctx.request.body.username !== updatedUser.username) {
			errors.push({
				message: 'Cannot change username for already local account.',
				path: 'username',
				value: ctx.request.body.username,
				kind: 'read_only'
			});
		}

		// CHANNEL CONFIG
		if (ctx.request.body.channel_config && !realtime.isUserEnabled(updatedUser)) {
			errors.push({
				message: 'Realtime features are not enabled for this account.',
				path: 'channel_config'
			});
		}

		// validate
		try {
			await updatedUser.validate();
		} catch (validationErr) {
			if (validationErr.name === 'ValidationError') {
				values(validationErr.errors).forEach(err => errors.push(err));
			}
		}

		// if there are validation errors, die.
		if (errors.length > 0) {
			throw new ApiError().validationErrors(errors).warn().status(422);
		}

		// EMAIL CHANGE
		if (currentUser.email !== updatedUser.email) {

			// there ALREADY IS a pending request.
			if (currentUser.email_status && currentUser.email_status.code === 'pending_update') {

				// just ignore if it's a re-post of the same address (double patch for the same new email doesn't re-trigger the confirmation mail)
				if (currentUser.email_status.value === updatedUser.email) {
					updatedUser.email = currentUser.email;

					// otherwise fail
				} else {
					throw new ApiError().validationErrors([{
						message: 'You cannot update an email address that is still pending confirmation. If your previous change was false, reset the email first by providing the original value.',
						path: 'email'
					}]).status(422);
				}

			} else {
				// check if we've already validated this address
				if (currentUser.validated_emails.includes(updatedUser.email)) {
					updatedUser.email_status = { code: 'confirmed' };

				} else {
					updatedUser.email_status = {
						code: 'pending_update',
						token: randomstring.generate(16),
						expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
						value: updatedUser.email
					};
					updatedUser.email = currentUser.email;
					await LogUserUtil.success(ctx, updatedUser, 'update_email_request', {
						'old': { email: currentUser.email },
						'new': { email: updatedUser.email_status.value }
					});
					await emailUpdateConfirmation(updatedUser);
				}
			}

		} else if (ctx.request.body.email) {
			// in here it's a special case:
			// the email has been posted but it's the same as the current
			// email. this situation is meant for aborting a pending
			// confirmation request and set the email back to what it was.

			// so IF we really are pending, simply set back the status to "confirmed".
			if (currentUser.email_status && currentUser.email_status.code === 'pending_update') {
				logger.warn('[ProfileApi.update] Canceling email confirmation with token "%s" for user <%s> -> <%s> (%s).', currentUser.email_status.token, currentUser.email, currentUser.email_status.value, currentUser.id);
				await LogUserUtil.success(ctx, updatedUser, 'cancel_email_update', {
					email: currentUser.email,
					email_canceled: currentUser.email_status.value
				});
				updatedUser.email_status = { code: 'confirmed' };
			}
		}

		const user = await updatedUser.save();
		await LogUserUtil.successDiff(ctx, updatedUser, 'update', pick(currentUser.toObject(), updatableFields), updatedUser);

		// log
		if (ctx.request.body.password) {
			if (ctx.request.body.username) {
				logger.info('[ProfileApi.update] Successfully added local credentials with username "%s" to user <%s> (%s).', user.username, user.email, user.id);
			} else {
				logger.info('[ProfileApi.update] Successfully changed password of user "%s".', user.username);
			}
		}
		ctx.state.user = user;

		// if all good, enrich with ACLs
		const acls = await this.getACLs(user);

		if (testMode && ctx.request.body.returnEmailToken) {
			return this.success(ctx, extend(state.serializers.User.detailed(ctx, user), acls, { email_token: (user.email_status as any).toObject().token }), 200);
		}
		return this.success(ctx, extend(state.serializers.User.detailed(ctx, user), acls), 200);
	}

	/**
	 * Confirms user's email for a given token.
	 *
	 * @see GET /v1/profile/confirm/:tkn
	 * @param ctx Koa context
	 */
	public async confirm(ctx: Context) {

		const failMsg = 'No such token or token expired.';

		let user = await state.models.User.findOne({ 'email_status.token': ctx.params.tkn }).exec();
		if (!user) {
			throw new ApiError('No user found with email token "%s".', ctx.params.tkn)
				.display(failMsg)
				.warn()
				.status(404);
		}
		if (user.email_status.expires_at.getTime() < new Date().getTime()) {
			throw new ApiError('Email token "%s" for user <%s> is expired (%s).', ctx.params.tkn, user.email, user.email_status.expires_at)
				.display(failMsg)
				.warn()
				.status(404);
		}

		const emailToConfirm = user.email_status.value;
		logger.info('[ProfileApi.confirm] Email %s confirmed.', emailToConfirm);

		// now we have a valid user that is either pending registration or update.
		// BUT meanwhile there might have been an oauth account creation with the same email,
		// or even another unconfirmed local account. so check if we need to merge or delete.
		const otherUsers = await state.models.User.find({
			$or: [
				{ email: emailToConfirm },
				{ emails: emailToConfirm },
				{ validated_emails: emailToConfirm }
			],
			id: { $ne: user.id }
		}).exec();

		let delCounter = 0;
		const mergeUsers: User[] = [];
		for (let otherUser of otherUsers) {
			// "pending_registration" are the only accounts where "email" is not confirmed ("pending_update" doesn't update "email").
			// these can be deleted because they don't have anything merge-worthy (given it's an email confirmation, we already have local credentials).
			if (otherUser.email_status && otherUser.email_status.code === 'pending_registration') {
				logger.info('[ProfileApi.confirm] Deleting pending registration user with same email <%s>.', otherUser.email);
				await otherUser.remove();
				delCounter++;

			} else {
				// the rest (confirmed) needs merging
				mergeUsers.push(otherUser);
			}
		}
		logger.info('[ProfileApi.confirm] Found %s confirmed and %s unconfirmed dupe users for %s.', mergeUsers.length, delCounter, user.email);

		// auto-merge if only one user without credentials
		if (mergeUsers.length === 1 && !mergeUsers[0].is_local) {
			user = await UserUtil.mergeUsers(ctx, user, mergeUsers[0], null);

		// otherwise we need to manually merge.
		} else if (mergeUsers.length > 0) {
			const explanation = `During the email validation, another account with the same email was created and validated. If that wasn't you, you should be worried an contact us immediately!`;
			user = await UserUtil.tryMergeUsers(ctx, [user, ...mergeUsers], explanation);
		}

		let logEvent:string, successMsg:string;
		const currentCode = user.email_status.code;
		if (currentCode === 'pending_registration') {
			user.is_active = true;
			logger.info('[ProfileApi.confirm] User email <%s> for pending registration confirmed.', user.email);
			successMsg = 'Email successfully validated. You may login now.';
			logEvent = 'registration_email_confirmed';

		} else {
			logger.info('[ProfileApi.confirm] User email <%s> confirmed.', emailToConfirm);
			user.email = emailToConfirm;
			successMsg = 'Email validated and updated.';
			logEvent = 'email_confirmed';
		}
		user.email_status = { code: 'confirmed' };
		user.validated_emails = user.validated_emails || [];
		user.validated_emails.push(user.email);
		user.validated_emails = uniq(user.validated_emails);

		await user.save();
		await LogUserUtil.success(ctx, user, logEvent, { email: user.email });

		if (logEvent === 'registration_email_confirmed' && config.vpdb.email.confirmUserEmail) {
			await welcomeLocal(user);
		}

		return this.success(ctx, {
			message: successMsg,
			previous_code: currentCode,
			deleted_users: delCounter,
			merged_users: mergeUsers.length
		});
	}


	/**
	 * Authentication route for third party strategies.
	 *
	 * Note that this is passed as-is to passport, so the URL params should be the
	 * same as the ones from the third party provider.
	 *
	 * @param ctx Koa context
	 * @param {function} next
	 */
	// public async authenticateOAuth2(ctx: Context, next) {
	//
	// 	// use passport with a custom callback: http://passportjs.org/guide/authenticate/
	// 	passport.authenticate(ctx.params.strategy, passportCallback(req, res))(req, res, next);
	// }


	/**
	 * Skips passport authentication and processes the user profile directly.
	 * @returns {Function}
	 */
	// public async authenticateOAuth2Mock(ctx: Context) {
	// 	logger.info('[api|user:auth-mock] Processing mock authentication via %s...', ctx.request.body.provider);
	// 	const profile = ctx.request.body.profile;
	// 	if (profile) {
	// 		profile._json = {
	// 			info: 'This mock data and is more complete otherwise.',
	// 			id: ctx.request.body.profile ? ctx.request.body.profile.id : null
	// 		};
	// 	}
	// 	ctx.params = { strategy: ctx.request.body.provider };
	// 	require('../../../src/common/passport').verifyCallbackOAuth(ctx.request.body.provider, ctx.request.body.providerName)(ctx, null, null, profile, this.passportCallback(ctx).bind(this));
	// }

	/**
	 * Returns a custom callback function for passport. It basically checks if the
	 * user object was populated, enriches it and returns it or fails.
	 *
	 * @param ctx Koa context
	 * @returns {Function}
	 */
	// private passportCallback(ctx: Context) {
	// 	return function (err, user, info) {
	// 		if (err) {
	// 			if (err.oauthError) {
	// 				return api.fail(res, error(err, 'Authentication failed: %j', err.oauthError).warn('authenticate', ctx.params.strategy), err.code || 401);
	//
	// 			} else if (err.code === 'invalid_grant') {
	// 				return api.fail(res, error('Previous grant is not valid anymore. Try again.').warn('authenticate', ctx.params.strategy), 401);
	//
	// 			} else {
	// 				return api.fail(res, err);
	// 			}
	//
	// 		}
	// 		if (!user) {
	// 			return api.fail(res, error('No user object in passport callback. More info: %j', info)
	// 					.display(info ? info : 'Could not retrieve user.')
	// 					.log('authenticate', ctx.params.strategy),
	// 				500);
	// 		}
	//
	// 		// fail if user inactive
	// 		if (!user.is_active) {
	// 			await
	// 			LogUserUtil.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account.');
	// 			throw new ApiError('User <%s> is disabled, refusing access', user.email)
	// 				.display('Inactive account. Please contact an administrator')
	// 				.warn('authenticate')
	// 				.status(403);
	// 		}
	//
	// 		// generate token and return.
	// 		const now = new Date();
	// 		const expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
	// 		const token = auth.generateApiToken(user, now, false);
	//
	// 		logger.info('[api|%s:authenticate] User <%s> successfully authenticated.', ctx.params.strategy, user.email);
	// 		getACLs(user).then(acls => {
	// 			return api.success(res, {
	// 				token: token,
	// 				expires: expires,
	// 				user: _.extend(state.serializers.User.detailed(user, req), acls)
	// 			}, 200);
	// 		});
	// 	}
	// }

	/**
	 * Returns the ACLs for a given user.
	 *
	 * @param {User} user
	 * @return Promise.<{permissions: string[]}>
	 */
	private async getACLs(user: User): Promise<{ permissions: string[] }> {
		const roles = await acl.userRoles(user.id);
		const resources = await acl.whatResources(roles);
		const permissions = await acl.allowedPermissions(user.id, Object.keys(resources));
		return { permissions: permissions };
	}
}
