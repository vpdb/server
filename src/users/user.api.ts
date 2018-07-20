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

import { assign, assignIn, difference, escapeRegExp, includes, isNumber, isObject, isString, pick, uniq } from 'lodash';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError, ApiValidationError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { LogUserUtil } from '../log-user/log.user.util';
import { state } from '../state';
import { UserDocument } from './user.document';
import { UserUtil } from './user.util';

const randomString = require('randomstring');
const validator = require('validator');

export class UserApi extends Api {

	/**
	 * Creates a new user.
	 *
	 * @see POST /v1/users
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async create(ctx: Context) {

		const newUser: UserDocument = assignIn<UserDocument>(pick(ctx.request.body, 'username', 'password', 'email'), {
			is_local: true,
			name: ctx.request.body.name || ctx.request.body.username,
		});

		// api test behavior
		const testMode = process.env.NODE_ENV === 'test';
		const skipEmailConfirmation = testMode && ctx.request.body.skipEmailConfirmation;

		// TODO make sure newUser.email is sane (comes from user directly)
		let user = await state.models.User.findOne({
			$or: [
				{ emails: newUser.email },
				{ validated_emails: newUser.email },
			],
		}).exec();

		if (user) {
			throw new ApiError('User with email <%s> already exists.', newUser.email).warn().status(409);
		}
		const confirmUserEmail = config.vpdb.email.confirmUserEmail && !skipEmailConfirmation;
		user = await UserUtil.createUser(ctx, newUser, confirmUserEmail);

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').signup_track({ email: user.email });
		}

		await LogUserUtil.success(ctx, user, 'registration', {
			provider: 'local',
			email: newUser.email,
			username: newUser.username,
		});

		// user validated and created. time to send the activation email.
		if (config.vpdb.email.confirmUserEmail) {
			await mailer.registrationConfirmation(user);
		}

		// return result now and send email afterwards
		if (testMode && ctx.request.body.returnEmailToken) {
			return this.success(ctx, assign(state.serializers.User.detailed(ctx, user), { email_token: (user.email_status as any).toObject().token }), 201);

		} else {
			return this.success(ctx, state.serializers.User.detailed(ctx, user), 201);
		}
	}

	/**
	 * Creates or updates a user.
	 *
	 * This is only accessible by registered OAuth providers.
	 *
	 * @see PUT /v1/users
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async createOrUpdate(ctx: Context) {

		let provider: string;
		let isNew: boolean;

		// make sure there's a provider token
		if (!ctx.state.appToken || ctx.state.tokenType !== 'provider') {
			throw new ApiError('Resource only available with provider token.').status(400);
		}
		provider = ctx.state.appToken.provider;

		// validations
		let err = null;
		if (!ctx.request.body.provider_id) {
			err = (err || new ApiError()).validationError('provider_id', 'Identifier at provider is required.');
		} else if (!isString(ctx.request.body.provider_id) && !isNumber(ctx.request.body.provider_id)) {
			err = (err || new ApiError()).validationError('provider_id', 'Identifier at provider must be a number or a string.');
		}
		if (!ctx.request.body.email || !isString(ctx.request.body.email)) {
			err = (err || new ApiError()).validationError('email', 'Email is required.');

		} else if (!validator.isEmail(ctx.request.body.email)) {
			err = (err || new ApiError()).validationError('email', 'Email is invalid.');
		}
		if (!ctx.request.body.username) {
			err = (err || new ApiError()).validationError('username', 'Username is required.');
		} else if (!isString(ctx.request.body.username)) {
			err = (err || new ApiError()).validationError('username', 'Username must be a string.');
		} else if (!/^[0-9a-z ]{3,}$/i.test(UserUtil.removeDiacritics(ctx.request.body.username).replace(/[^0-9a-z ]+/gi, ''))) {
			err = (err || new ApiError()).validationError('username', 'Username must be alphanumeric with at least three characters.', ctx.request.body.username);
		}
		if (ctx.request.body.provider_profile && !isObject(ctx.request.body.provider_profile)) {
			err = (err || new ApiError()).validationError('provider_profile', 'Must be an object.');
		}
		if (err) {
			throw err;
		}

		// create query condition
		const query = {
			$or: [
				{ ['providers.' + provider + '.id']: ctx.request.body.provider_id },
				{ email: ctx.request.body.email },
				{ validated_emails: ctx.request.body.email },
			],
		};
		const existingUser = await state.models.User.findOne(query).exec();

		let user: UserDocument;
		if (existingUser) {
			user = await this.updateProviderUser(ctx, existingUser, provider);
			isNew = false;
		} else {
			user = await this.createProviderUser(ctx, provider);
			isNew = true;
		}

		await LogUserUtil.success(ctx, user, 'provider_registration', { provider, email: user.email });
		return this.success(ctx, state.serializers.User.detailed(ctx, user), isNew ? 201 : 200);
	}

	/**
	 * Lists users.
	 *
	 * Note that as non-admin, a search query must be provided and returned
	 * details are reduced.
	 *
	 * @see GET /v1/users
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async list(ctx: Context) {

		const canList = ctx.state.user && await acl.isAllowed(ctx.state.user.id, 'users', 'list');
		const canGetFullDetails = ctx.state.user && await acl.isAllowed(ctx.state.user.id, 'users', 'full-details');

		if (!canList && (!ctx.request.query.q || ctx.request.query.q.length < 3) && !ctx.request.query.name) {
			throw new ApiError('Please provide a search query with at least three characters or a user name').status(403);
		}
		const query = [];

		// text search
		if (ctx.request.query.q) {
			// sanitize and build regex
			const q = ctx.request.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
			const regex = new RegExp(q, 'i');
			if (canList) {
				query.push({
					$or: [
						{ name: regex },
						{ username: regex },
						{ email: regex },
					],
				});
			} else {
				query.push({
					$or: [
						{ name: regex },
						{ username: regex },
					],
				});
			}
		}
		if (ctx.request.query.name) {
			query.push({ name: new RegExp('^' + escapeRegExp(ctx.request.query.name) + '$', 'i') });
		}

		// filter by role
		if (canList && ctx.request.query.roles) {
			// sanitze and split
			const roles = ctx.request.query.roles.trim().replace(/[^a-z0-9,-]+/gi, '').split(',');
			query.push({ roles: { $in: roles } });
		}
		let users = await state.models.User.find(this.searchQuery(query)).exec();

		// reduce
		users = users.map(user => canGetFullDetails ?
			state.serializers.User.detailed(ctx, user) :
			state.serializers.User.simple(ctx, user),
		);
		return this.success(ctx, users);
	}

	/**
	 * Updates an existing user.
	 *
	 * @see PUT /v1/users/:id
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async update(ctx: Context) {

		const updatableFields = ['name', 'email', 'username', 'is_active', 'roles', '_plan'];
		const user: UserDocument = await state.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user.').status(404);
		}

		const updatedUser = ctx.request.body;

		// 1. check for changed read-only fields
		const readOnlyFieldErrors = this.checkReadOnlyFields(ctx.request.body, user, updatableFields);
		if (readOnlyFieldErrors) {
			throw new ApiError('User tried to update read-only fields').validationErrors(readOnlyFieldErrors as ApiValidationError[]).warn();
		}

		// 2. check for permission escalation
		const callerRoles = ctx.state.user.roles || [];
		const currentUserRoles = user.roles || [];
		const updatedUserRoles = updatedUser.roles || [];

		const removedRoles = difference(currentUserRoles, updatedUserRoles);
		const addedRoles = difference(updatedUserRoles, currentUserRoles);

		const diff = LogUserUtil.diff(pick(user.toObject(), updatableFields), updatedUser);

		// if caller is not root..
		if (!includes(callerRoles, 'root')) {

			logger.info('[UserApi.update] Checking for privilege escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(ctx.state.user._id) && (includes(currentUserRoles, 'root') || includes(currentUserRoles, 'admin'))) {

				// log
				await LogUserUtil.failure(ctx, user, 'update', diff, ctx.state.user, 'User is not allowed to update administrators or root users.');

				// fail
				throw new ApiError('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', ctx.state.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
					.display('You are not allowed to update administrators or root users.')
					.log()
					.status(403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (addedRoles.includes('root') || addedRoles.includes('admin') || removedRoles.includes('root') || removedRoles.includes('admin')) {

				// log
				await LogUserUtil.failure(ctx, user, 'update', diff, ctx.state.user, 'User is not allowed change the admin or root role for anyone.');

				// fail
				throw new ApiError('PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', ctx.state.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '))
					.display('You are not allowed change the admin or root role for anyone.')
					.log()
					.status(403);
			}
		}

		// 3. copy over new values
		updatableFields.forEach(field => {
			user[field] = updatedUser[field];
		});

		// 4. save
		await user.save();

		await LogUserUtil.successDiff(ctx, ctx.state.user, 'update', pick(user.toObject(), updatableFields), updatedUser, ctx.state.user);
		logger.info('[UserApi.update] Success!');

		// 5. update ACLs if roles changed
		if (removedRoles.length > 0) {
			logger.info('[UserApi.update] Updating ACLs: Removing roles [%s] from user <%s>.', removedRoles.join(' '), user.email);
			await acl.removeUserRoles(user.id, removedRoles);
		}
		if (addedRoles.length > 0) {
			logger.info('[UserApi.update] Updating ACLs: Adding roles [%s] to user <%s>.', addedRoles.join(' '), user.email);
			await acl.addUserRoles(user.id, addedRoles);
		}

		// 6. if changer is not changed user, mark user as dirty
		if (!ctx.state.user._id.equals(user._id)) {
			logger.info('[UserApi.update] Marking user <%s> as dirty.', user.email);
			await state.redis.set('dirty_user_' + user.id, String(new Date().getTime()));
			await state.redis.expire('dirty_user_' + user.id, 10000);
		}
		return this.success(ctx, state.serializers.User.detailed(ctx, user), 200);
	}

	/**
	 * Returns user details for a given ID
	 *
	 * @see GET /v1/users/:id
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async view(ctx: Context) {
		const user = await state.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		const fullDetails = await acl.isAllowed(ctx.state.user.id, 'users', 'full-details');
		return this.success(ctx, fullDetails ? state.serializers.User.detailed(ctx, user) : state.serializers.User.simple(ctx, user));
	}

	/**
	 * Deletes an existing user.
	 *
	 * @see DELETE /v1/users/:id
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async del(ctx: Context) {

		const user = await state.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		await acl.removeUserRoles(user.id, user.roles);
		await user.remove();

		logger.info('[UserApi.delete] User <%s> successfully deleted.', user.email);
		return this.success(ctx, null, 204);
	}

	/**
	 * Resets the token and expiration date and resends the confirmation mail to
	 * an existing user.
	 *
	 * Needed if the user spelled the email wrong the first time or didn't click on
	 * the link within 24 hours.
	 *
	 * @see POST /v1/users/:id/send-confirmation
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	public async sendConfirmationMail(ctx: Context) {

		const user = await state.models.User.findOne({ id: ctx.params.id }).exec();

		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		if (user.email_status.code === 'confirmed') {
			throw new ApiError('Cannot re-send confirmation mail to already confirmed address.').status(400);
		}
		user.email_status.token = randomString.generate(16);
		user.email_status.expires_at = new Date(new Date().getTime() + 86400000); // 1d valid

		await user.save();
		await mailer.registrationConfirmation(user);

		return this.success(ctx, null, 200);
	}

	private async updateProviderUser(ctx: Context, existingUser: UserDocument, provider: string): Promise<UserDocument> {
		if (!existingUser.providers || !existingUser.providers[provider]) {
			existingUser.providers = existingUser.providers || {};
			existingUser.providers[provider] = {
				id: String(ctx.request.body.provider_id),
				name: ctx.request.body.username || (ctx.request.body.email ? ctx.request.body.email.substr(0, ctx.request.body.email.indexOf('@')) : undefined),
				emails: [ctx.request.body.email],
				created_at: new Date(),
				modified_at: new Date(),
				profile: ctx.request.body.provider_profile,
			};
			await LogUserUtil.success(ctx, existingUser, 'provider_add', {
				provider,
				profile: ctx.request.body.provider_profile,
			});
		} else {
			existingUser.providers[provider].modified_at = new Date();
			await LogUserUtil.success(ctx, existingUser, 'provider_update', { provider });
		}
		existingUser.emails = uniq([existingUser.email, ...existingUser.emails, ctx.request.body.email]);
		return existingUser.save();
	}

	private async createProviderUser(ctx: Context, provider: string): Promise<UserDocument> {
		// check if username doesn't conflict
		let newUser;
		let name = UserUtil.removeDiacritics(ctx.request.body.username).replace(/[^0-9a-z ]+/gi, '');
		const originalName = name;
		const dupeNameUser = await state.models.User.findOne({ name }).exec();
		if (dupeNameUser) {
			name += Math.floor(Math.random() * 1000);
		}
		newUser = {
			is_local: false,
			name,
			email: ctx.request.body.email,
			emails: [ctx.request.body.email],
			providers: {
				[provider]: {
					id: String(ctx.request.body.provider_id),
					name: originalName,
					emails: [ctx.request.body.email],
					created_at: new Date(),
					profile: ctx.request.body.provider_profile,
				},
			},
		};
		return UserUtil.createUser(ctx, newUser as UserDocument, false);
	}
}
