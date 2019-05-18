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

import { assign, isString, pick, uniq } from 'lodash';
import randomString from 'randomstring';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { quota } from '../common/quota';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { LogUserUtil } from '../log-user/log.user.util';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { UserUtil } from '../users/user.util';

export class ProfileApi extends Api {

	private readonly updatableFields = ['name', 'location', 'email', 'preferences', 'channel_config'];

	/**
	 * Returns the current user's profile.
	 *
	 * @see GET /v1/profile
	 * @param ctx Koa context
	 */
	public async view(ctx: Context) {

		const acls = await this.getACLs(ctx.state.user);
		const q = await quota.get(ctx.state, ctx.state.user);
		this.success(ctx, assign(state.serializers.User.detailed(ctx, ctx.state.user), acls, { quota: q }), 200);
	}

	/**
	 * Updates the current user's profile.
	 *
	 * @see PATCH /v1/profile
	 * @param ctx Koa context
	 */
	public async update(ctx: Context) {

		// api test behavior
		const testMode = process.env.NODE_ENV === 'test';

		const updatedUser = await state.models.User.findById(ctx.state.user._id).exec();
		if (!updatedUser) {
			throw new ApiError('User not found. Seems be deleted since last login.').status(404);
		}
		const oldUser = state.serializers.User.reduced(ctx, updatedUser);

		// UPDATE SUBMITTED FIELDS
		await this.changeAttributes(ctx, updatedUser);

		// UPDATE PASSWORD
		if (ctx.request.body.password && !ctx.request.body.username) {
			await this.changePassword(ctx, updatedUser);
		}

		// CREATE LOCAL ACCOUNT
		if (ctx.request.body.username) {
			await this.createLocalAccount(ctx, updatedUser);
		}

		// validate now, because below we assume that the email address is (syntactically) valid
		await updatedUser.validate();

		// EMAIL CHANGE
		if (ctx.state.user.email !== updatedUser.email) {
			await this.changeEmail(ctx, updatedUser);

		} else if (ctx.request.body.email) {
			// in here it's a special case:
			// the email has been posted but it's the same as the current
			// email. this situation is meant for aborting a pending
			// confirmation request and set the email back to what it was.

			// so IF we really are pending, simply set back the status to "confirmed".
			if (ctx.state.user.email_status && ctx.state.user.email_status.code === 'pending_update') {
				await this.cancelEmailChange(ctx, updatedUser);
			}
		}

		const user = await updatedUser.save();
		await LogUserUtil.successDiff(ctx, updatedUser, 'update', pick(ctx.state.user.toObject(), this.updatableFields), updatedUser);

		// invalidate cache
		const newUser = state.serializers.User.reduced(ctx, user);
		if (!this.hasFieldsModified(oldUser, newUser, [ 'name', 'username', 'email'])) {
			await apiCache.invalidateUpdatedUser(ctx.state, user, ['simple', 'detailed']);
		} else {
			await apiCache.invalidateUpdatedUser(ctx.state, user);
		}

		// log
		if (ctx.request.body.password) {
			if (ctx.request.body.username) {
				logger.info(ctx.state, '[ProfileApi.update] Successfully added local credentials with username "%s" to user <%s> (%s).', user.username, user.email, user.id);
			} else {
				logger.info(ctx.state, '[ProfileApi.update] Successfully changed password of user "%s".', user.username);
			}
		}
		ctx.state.user = user;

		// if all good, enrich with ACLs
		const acls = await this.getACLs(user);

		if (testMode && ctx.request.body.returnEmailToken) {
			this.success(ctx, assign(state.serializers.User.detailed(ctx, user), acls, { email_token: (user.email_status as any).toObject().token }), 200);
		} else {
			this.success(ctx, assign(state.serializers.User.detailed(ctx, user), acls), 200);
		}
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
		logger.info(ctx.state, '[ProfileApi.confirm] Email %s confirmed.', emailToConfirm);

		// now we have a valid user that is either pending registration or update.
		// BUT meanwhile there might have been an oauth account creation with the same email,
		// or even another unconfirmed local account. so check if we need to merge or delete.
		const otherUsers = await state.models.User.find({
			$or: [
				{ email: emailToConfirm },
				{ emails: emailToConfirm },
				{ validated_emails: emailToConfirm },
			],
			id: { $ne: user.id },
		}).exec();

		let delCounter = 0;
		const mergeUsers: UserDocument[] = [];
		for (const otherUser of otherUsers) {
			// "pending_registration" are the only accounts where "email" is not confirmed ("pending_update" doesn't update "email").
			// these can be deleted because they don't have anything merge-worthy (given it's an email confirmation, we already have local credentials).
			if (otherUser.email_status && otherUser.email_status.code === 'pending_registration') {
				logger.info(ctx.state, '[ProfileApi.confirm] Deleting pending registration user with same email <%s>.', otherUser.email);
				await otherUser.remove();
				delCounter++;

			} else {
				// the rest (confirmed) needs merging
				mergeUsers.push(otherUser);
			}
		}
		logger.info(ctx.state, '[ProfileApi.confirm] Found %s confirmed and %s unconfirmed dupe users for %s.', mergeUsers.length, delCounter, user.email);

		// auto-merge if only one user without credentials
		if (mergeUsers.length === 1 && !mergeUsers[0].is_local) {
			user = await UserUtil.mergeUsers(ctx, user, mergeUsers[0], null);

		// otherwise we need to manually merge.
		} else if (mergeUsers.length > 0) {
			const explanation = `During the email validation, another account with the same email was created and validated. If that wasn't you, you should be worried an contact us immediately!`;
			user = await UserUtil.tryMergeUsers(ctx, [user, ...mergeUsers], explanation);
		}

		let logEvent: string;
		let successMsg: string;
		const currentCode = user.email_status.code;
		if (currentCode === 'pending_registration') {
			user.is_active = true;
			logger.info(ctx.state, '[ProfileApi.confirm] User email <%s> for pending registration confirmed.', user.email);
			successMsg = 'Email successfully validated. You may login now.';
			logEvent = 'registration_email_confirmed';

		} else {
			logger.info(ctx.state, '[ProfileApi.confirm] User email <%s> confirmed.', emailToConfirm);
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

		this.success(ctx, {
			message: successMsg,
			previous_code: currentCode,
			deleted_users: delCounter,
			merged_users: mergeUsers.length,
		});

		this.noAwait(async () => {
			if (logEvent === 'registration_email_confirmed' && config.vpdb.email.confirmUserEmail) {
				await mailer.welcomeLocal(ctx.state, user);
			}
		});
	}

	/**
	 * Requests a password request for a given email address
	 *
	 * @see POST /v1/profile/request-password-reset
	 * @param ctx Koa context
	 */
	public async requestResetPassword(ctx: Context) {

		// this resource is lock-protected
		await this.ipLockAssert(ctx, config.vpdb.passwordResetBackoff);

		if (!ctx.request.body.email) {
			throw new ApiError().validationError('email', 'Email must be provided');
		}
		if (!isString(ctx.request.body.email)) {
			throw new ApiError().validationError('email', 'Email must be a string');
		}
		const email = ctx.request.body.email.trim();

		// TODO make sure newUser.email is sane (comes from user directly)
		const user = await state.models.User.findOne({
			$or: [
				{ emails: email },
				{ validated_emails: email },
			],
		}).exec();

		// check if email exists
		if (!user) {
			await this.ipLockOnFail(ctx, config.vpdb.passwordResetBackoff,
				new ApiError().validationError('email', 'Can\'t find that email, sorry.'));
		}

		// potentially unlock ip block
		await this.ipLockOnSuccess(ctx, config.vpdb.passwordResetBackoff);

		// check if user is local
		if (!user.is_local) {
			const providers = user.getProviderNames();
			const lastProvider = providers.pop();
			const via = providers.length ? [ providers.join(', '), lastProvider ].join(' or ') : lastProvider;
			throw new ApiError('You don\'t have a password set because you\'ve previously logged in via %s.', via).status(400);
		}

		// set reset token
		const token = randomString.generate(16);
		await state.models.User.findOneAndUpdate({ _id: user._id },
		{ $set: {
				password_reset: {
					token,
					expires_at: new Date(Date.now() + 86400000), // 1d valid
				},
			} }).exec();

		// log
		await LogUserUtil.success(ctx, user, 'request_reset_password');

		// return body
		if (process.env.NODE_ENV === 'test' && ctx.request.body.returnEmailToken) {
			this.success(ctx, { message: 'Email sent.', token });
		} else {
			/* istanbul ignore next: Test case is above */
			this.success(ctx, { message: 'Email sent.' });
		}

		// send password reset mail
		this.noAwait(async () => {
			await mailer.resetPasswordRequest(ctx.state, user, email, token);
		});
	}

	/**
	 * Sets a new password with a previously requested token
	 *
	 * @see POST /v1/profile/password-reset
	 * @param ctx Koa context
	 */
	public async resetPassword(ctx: Context) {

		// this resource is lock-protected
		await this.ipLockAssert(ctx, config.vpdb.passwordResetBackoff);

		// validations
		if (!ctx.request.body.token) {
			throw new ApiError().validationError('token', 'Token must be provided');
		}
		if (!isString(ctx.request.body.token)) {
			throw new ApiError().validationError('token', 'Token must be a string');
		}
		if (!ctx.request.body.password) {
			throw new ApiError().validationError('password', 'Password must be provided');
		}
		if (!isString(ctx.request.body.password)) {
			throw new ApiError().validationError('password', 'Password must be a string');
		}
		const user = await state.models.User.findOne({ 'password_reset.token': ctx.request.body.token });
		if (!user) {
			await this.ipLockOnFail(ctx, config.vpdb.passwordResetBackoff,
				new ApiError().validationError('token', 'Invalid token', ctx.request.body.token));
		}
		if (user.password_reset.expires_at.getTime() < Date.now()) {
			throw new ApiError().validationError('token', 'Token expired. Please request a password reset again.');
		}

		// save new password
		user.password = ctx.request.body.password;
		user.password_reset = null;
		await user.save();

		// log
		await LogUserUtil.success(ctx, user, 'reset_password');

		// potentially unlock ip block
		await this.ipLockOnSuccess(ctx, config.vpdb.passwordResetBackoff);

		// return body
		this.success(ctx, { message: 'Password updated.' });

		// send confirmation
		this.noAwait(async () => {
			await mailer.resetPasswordSuccess(ctx.state, user);
		});
	}

	private async changeAttributes(ctx: Context, updatedUser: UserDocument) {
		// check for dupe name
		if (ctx.request.body.name) {
			await this.validateName(ctx, ctx.request.body.name);
		}
		// apply new data
		assign(updatedUser, pick(ctx.request.body, this.updatableFields));
	}

	private async validateName(ctx: Context, name: string) {
		const dupeNameUser = await state.models.User.findOne({ name, id: { $ne: ctx.state.user.id }}).exec();
		if (dupeNameUser) {
			throw new ApiError().validationError('name', 'User with this name already exists', ctx.request.body.name);
		}
	}

	private async changePassword(ctx: Context, updatedUser: UserDocument) {
		// check for current password
		if (!ctx.request.body.current_password) {
			throw new ApiError().validationError('current_password', 'You must provide your current password.');

		} else {
			// change password
			if (updatedUser.authenticate(ctx.request.body.current_password)) {
				updatedUser.password = ctx.request.body.password;
				await LogUserUtil.success(ctx, updatedUser, 'change_password');
			} else {
				logger.warn(ctx.state, '[ProfileApi.update] User <%s> provided wrong current password while changing.', ctx.state.user.email);
				throw new ApiError().validationError('current_password', 'Invalid password.');
			}
		}
	}

	private async createLocalAccount(ctx: Context, updatedUser: UserDocument) {
		if (!ctx.state.user.is_local) {
			if (!ctx.request.body.password) {
				throw new ApiError().validationError('password', 'You must provide your new password when creating a local account.');

			} else {
				updatedUser.password = ctx.request.body.password;
				updatedUser.username = ctx.request.body.username;
				updatedUser.is_local = true;
				await LogUserUtil.success(ctx, updatedUser, 'create_local_account', { username: ctx.request.body.username });
			}
		}
		if (ctx.state.user.is_local && ctx.request.body.username !== updatedUser.username) {
			throw new ApiError().validationError('username', 'Cannot change username for already local account.', ctx.request.body.username, 'read_only');
		}
	}

	private async changeEmail(ctx: Context, updatedUser: UserDocument) {

		// there ALREADY IS a pending request.
		if (ctx.state.user.email_status && ctx.state.user.email_status.code === 'pending_update') {

			// just ignore if it's a re-post of the same address (double patch for the same new email doesn't re-trigger the confirmation mail)
			if (ctx.state.user.email_status.value === updatedUser.email) {
				updatedUser.email = ctx.state.user.email;

				// otherwise fail
			} else {
				throw new ApiError().validationError('email', 'You cannot update an email address that is still pending confirmation. If your previous change was false, reset the email first by providing the original value.');
			}

		} else {
			// check if we've already validated this address
			if (ctx.state.user.validated_emails.includes(updatedUser.email)) {
				updatedUser.email_status = { code: 'confirmed' };

			} else {
				updatedUser.email_status = {
					code: 'pending_update',
					token: randomString.generate(16),
					expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
					value: updatedUser.email,
				};
				updatedUser.email = ctx.state.user.email;
				await LogUserUtil.success(ctx, updatedUser, 'update_email_request', {
					old: { email: ctx.state.user.email },
					new: { email: updatedUser.email_status.value },
				});
				this.noAwait(async () => {
					await mailer.emailUpdateConfirmation(ctx.state, updatedUser);
				});
			}
		}
	}

	private async cancelEmailChange(ctx: Context, updatedUser: UserDocument) {
		logger.warn(ctx.state, '[ProfileApi.update] Canceling email confirmation with token "%s" for user <%s> -> <%s> (%s).', ctx.state.user.email_status.token, ctx.state.user.email, ctx.state.user.email_status.value, ctx.state.user.id);
		await LogUserUtil.success(ctx, updatedUser, 'cancel_email_update', {
			email: ctx.state.user.email,
			email_canceled: ctx.state.user.email_status.value,
		});
		updatedUser.email_status = { code: 'confirmed' };
	}

	/**
	 * Returns the ACLs for a given user.
	 *
	 * @param {UserDocument} user
	 * @return Promise.<{permissions: string[]}>
	 */
	private async getACLs(user: UserDocument): Promise<{ permissions: string[] }> {
		const span = this.apmStartSpan(`getACLs()`);
		const roles = await acl.userRoles(user.id);
		const resources = await acl.whatResources(roles);
		const permissions = await acl.allowedPermissions(user.id, Object.keys(resources));
		this.apmEndSpan(span);
		return { permissions };
	}
}
