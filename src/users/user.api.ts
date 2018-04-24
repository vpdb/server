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

import { promisify } from 'util';
import redis from 'redis';

import { Context } from '../common/types/context';
import { User } from './user.type';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';

const _ = require('lodash');
const randomString = require('randomstring');
const validator = require('validator');

const acl = require('../common/acl');
import { registrationConfirmation } from '../common/mailer';
import { logger } from '../common/logger';
import { config } from '../common/settings';
import { UserUtil } from './user.util';

export class UserApi extends Api {

	private readonly redisSet: any;
	private readonly redisExpire: any;

	constructor() {
		super();

		const redisClient = redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
		redisClient.select(config.vpdb.redis.db);
		redisClient.on('error', err => logger.error(err.message));

		this.redisSet = promisify(redisClient.set).bind(redisClient);
		this.redisExpire = promisify(redisClient.expire).bind(redisClient);
	}

	/**
	 * Creates a new user.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @return {Promise<boolean>}
	 */
	async create(ctx: Context) {

		const newUser = _.assignIn(_.pick(ctx.request.body, 'username', 'password', 'email'), {
			is_local: true,
			name: ctx.request.body.name || ctx.request.body.username
		});

		// api test behavior
		const testMode = process.env.NODE_ENV === 'test';
		const skipEmailConfirmation = testMode && ctx.request.body.skipEmailConfirmation;

		// TODO make sure newUser.email is sane (comes from user directly)
		let user = await ctx.models.User.findOne({
			$or: [
				{ emails: newUser.email },
				{ validated_emails: newUser.email }
			]
		}).exec();

		if (user) {
			throw new ApiError('User with email <%s> already exists.', newUser.email).warn().status(409);
		}
		let confirmUserEmail = config.vpdb.email.confirmUserEmail && !skipEmailConfirmation;
		user = await UserUtil.createUser(ctx, newUser, confirmUserEmail);

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').signup_track({ email: user.email });
		}

		// LogUser.success(req, user, 'registration', {
		// 	provider: 'local',
		// 	email: newUser.email,
		// 	username: newUser.username
		// });

		// user validated and created. time to send the activation email.
		if (config.vpdb.email.confirmUserEmail) {
			await registrationConfirmation(user);
		}

		// return result now and send email afterwards
		if (testMode && ctx.request.body.returnEmailToken) {
			return this.success(ctx, _.assign(ctx.serializers.User.detailed(ctx, user), { email_token: (user.email_status as any).toObject().token }), 201);

		} else {
			return this.success(ctx, ctx.serializers.User.detailed(ctx, user), 201);
		}
	}

	/**
	 * Creates or updates a user.
	 *
	 * This is only accessible by registered OAuth providers.
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async createOrUpdate(ctx: Context) {

		let name, provider, isNew;

		// make sure there's an app token
		if (!ctx.state.appToken) {
			throw new ApiError('Resource only available with application token.').status(400);
		}
		provider = ctx.state.appToken.provider;

		// validations
		let err = null;
		if (!ctx.request.body.provider_id) {
			err = (err || new ApiError()).validationError('provider_id', 'Identifier at provider is required.');
		} else if (!_.isString(ctx.request.body.provider_id) && !_.isNumber(ctx.request.body.provider_id)) {
			err = (err || new ApiError()).validationError('provider_id', 'Identifier at provider must be a number or a string.');
		}
		if (!ctx.request.body.email || !_.isString(ctx.request.body.email)) {
			err = (err || new ApiError()).validationError('email', 'Email is required.');

		} else if (!validator.isEmail(ctx.request.body.email)) {
			err = (err || new ApiError()).validationError('email', 'Email is invalid.');
		}
		if (!ctx.request.body.username) {
			err = (err || new ApiError()).validationError('username', 'Username is required.');
		} else if (!_.isString(ctx.request.body.username)) {
			err = (err || new ApiError()).validationError('username', 'Username must be a string.');
		} else if (!/^[0-9a-z ]{3,}$/i.test(UserUtil.removeDiacritics(ctx.request.body.username).replace(/[^0-9a-z ]+/gi, ''))) {
			err = (err || new ApiError()).validationError('username', 'Username must be alphanumeric with at least three characters.', ctx.request.body.username);
		}
		if (ctx.request.body.provider_profile && !_.isObject(ctx.request.body.provider_profile)) {
			err = (err || new ApiError()).validationError('provider_profile', 'Must be an object.');
		}
		if (err) {
			throw err;
		}
		name = UserUtil.removeDiacritics(ctx.request.body.username).replace(/[^0-9a-z ]+/gi, '');

		// create query condition
		const query = {
			$or: [
				{ ['providers.' + provider + '.id']: ctx.request.body.provider_id },
				{ email: ctx.request.body.email },
				{ validated_emails: ctx.request.body.email }
			]
		};
		const existingUser = await ctx.models.User.findOne(query).exec();

		let user;
		if (existingUser) {
			if (!existingUser.providers || !existingUser.providers[provider]) {
				existingUser.providers = existingUser.providers || {};
				existingUser.providers[provider] = {
					id: String(ctx.request.body.provider_id),
					name: ctx.request.body.username || (ctx.request.body.email ? ctx.request.body.email.substr(0, ctx.request.body.email.indexOf('@')) : undefined),
					emails: [ctx.request.body.email],
					created_at: new Date(),
					modified_at: new Date(),
					profile: ctx.request.body.provider_profile
				};
				// LogUser.success(req, existingUser, 'provider_add', {
				// 	provider: provider,
				// 	profile: ctx.request.body.provider_profile
				// });
			} else {
				existingUser.providers[provider].modified_at = new Date();
				//LogUser.success(req, existingUser, 'provider_update', { provider: provider });
			}
			existingUser.emails = _.uniq([existingUser.email, ...existingUser.emails, ctx.request.body.email]);
			isNew = false;
			user = await existingUser.save();

		} else {

			// check if username doesn't conflict
			let newUser;
			let originalName = name;
			const dupeNameUser = await ctx.models.User.findOne({ name: name }).exec();
			if (dupeNameUser) {
				name += Math.floor(Math.random() * 1000);
			}
			newUser = {
				is_local: false,
				name: name,
				email: ctx.request.body.email,
				emails: [ctx.request.body.email],
				providers: {
					[provider]: {
						id: String(ctx.request.body.provider_id),
						name: originalName,
						emails: [ctx.request.body.email],
						created_at: new Date(),
						profile: ctx.request.body.provider_profile
					}
				}
			};
			isNew = true;
			user = await UserUtil.createUser(ctx, newUser as User, false);
		}

		// LogUser.success(req, user, 'provider_registration', { provider: provider, email: user.email });
		return this.success(ctx, ctx.serializers.User.detailed(ctx, user), isNew ? 201 : 200);
	}

	/**
	 * Lists users.
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async list(ctx: Context) {

		const canList = ctx.state.user && await acl.isAllowed(ctx.state.user.id, 'users', 'list');
		const canGetFullDetails = ctx.state.user && await acl.isAllowed(ctx.state.user.id, 'users', 'full-details');

		if (!canList && (!ctx.request.query.q || ctx.request.query.q.length < 3) && !ctx.request.query.name) {
			throw new ApiError('Please provide a search query with at least three characters or a user name').status(403);
		}
		let query = [];

		// text search
		if (ctx.request.query.q) {
			// sanitize and build regex
			let q = ctx.request.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
			let regex = new RegExp(q, 'i');
			if (canList) {
				query.push({
					$or: [
						{ name: regex },
						{ username: regex },
						{ email: regex }
					]
				});
			} else {
				query.push({
					$or: [
						{ name: regex },
						{ username: regex }
					]
				});
			}
		}
		if (ctx.request.query.name) {
			query.push({ name: new RegExp('^' + _.escapeRegExp(ctx.request.query.name) + '$', 'i') });
		}

		// filter by role
		if (canList && ctx.request.query.roles) {
			// sanitze and split
			let roles = ctx.request.query.roles.trim().replace(/[^a-z0-9,-]+/gi, '').split(',');
			query.push({ roles: { $in: roles } });
		}
		let users = await ctx.models.User.find(this.searchQuery(query)).exec();

		// reduce
		users = users.map(user => canGetFullDetails ?
			ctx.serializers.User.detailed(ctx, user) :
			ctx.serializers.User.simple(ctx, user)
		);
		return this.success(ctx, users);
	}


	/**
	 * Updates an existing user.
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async update(ctx: Context) {

		// TODO move into model
		const updatableFields = ['name', 'email', 'username', 'is_active', 'roles', '_plan'];

		const user: User = await ctx.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user.').status(404);
		}

		const updatedUser = ctx.request.body;

		// 1. check for changed read-only fields
		const readOnlyFieldErrors = this.checkReadOnlyFields(ctx.request.body, user, updatableFields);
		if (readOnlyFieldErrors) {
			throw new ApiError('User tried to update read-only fields').validationErrors(readOnlyFieldErrors).warn();
		}

		// 2. check for permission escalation
		const callerRoles = ctx.state.user.roles || [];
		const currentUserRoles = user.roles || [];
		const updatedUserRoles = updatedUser.roles || [];

		const removedRoles = _.difference(currentUserRoles, updatedUserRoles);
		const addedRoles = _.difference(updatedUserRoles, currentUserRoles);

		const diff = {};// const diff = LogUser.diff(_.pick(user.toObject(), updatableFields), updatedUser);


		// if caller is not root..
		if (!_.includes(callerRoles, 'root')) {

			logger.info('[api|user:update] Checking for privilege escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(ctx.state.user._id) && (_.includes(currentUserRoles, 'root') || _.includes(currentUserRoles, 'admin'))) {

				// log
				// LogUser.failure(req, user, 'update', diff, ctx.state.user, 'User is not allowed to update administrators or root users.');

				// fail
				throw new ApiError('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', ctx.state.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
					.display('You are not allowed to update administrators or root users.')
					.log()
					.status(403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (addedRoles.includes('root') || addedRoles.includes('admin') || removedRoles.includes('root') || removedRoles.includes('admin')) {

				// log
				// LogUser.failure(req, user, 'update', diff, ctx.state.user, 'User is not allowed change the admin or root role for anyone.');

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

		// 4. validate
		await user.validate();

		// 5. save
		await user.save();

		// LogUser.successDiff(req, updatedUser, 'update', _.pick(user.toObject(), updatableFields), updatedUser, ctx.state.user);
		logger.info('[api|user:update] Success!');

		// 6. update ACLs if roles changed
		if (removedRoles.length > 0) {
			logger.info('[api|user:update] Updating ACLs: Removing roles [%s] from user <%s>.', removedRoles.join(' '), user.email);
			acl.removeUserRoles(user.id, removedRoles);
		}
		if (addedRoles.length > 0) {
			logger.info('[api|user:update] Updating ACLs: Adding roles [%s] to user <%s>.', addedRoles.join(' '), user.email);
			acl.addUserRoles(user.id, addedRoles);
		}

		// 7. if changer is not changed user, mark user as dirty
		if (!ctx.state.user._id.equals(user._id)) {
			logger.info('[api|user:update] Marking user <%s> as dirty.', user.email);
			await this.redisSet('dirty_user_' + user.id, String(new Date().getTime()));
			await this.redisExpire('dirty_user_' + user.id, 10000);
		}
		return this.success(ctx, ctx.serializers.User.detailed(ctx, user), 200);
	}

	/**
	 * Returns user details for a given ID
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async view(ctx:Context) {
		const user = await ctx.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		const fullDetails = await acl.isAllowed(ctx.state.user.id, 'users', 'full-details');
		return this.success(ctx, fullDetails ? ctx.serializers.User.detailed(ctx, user) : ctx.serializers.User.simple(ctx, user));
	}

	/**
	 * Deletes an existing user.
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async del(ctx:Context) {

		const user = await ctx.models.User.findOne({ id: ctx.params.id }).exec();
		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		await acl.removeUserRoles(user.id, user.roles);
		await user.remove();

		logger.info('[api|user:delete] User <%s> successfully deleted.', user.email);
		return this.success(ctx, null, 204);
	}


	/**
	 * Resets the token and expiration date and resends the confirmation mail to
	 * an existing user.
	 *
	 * Needed if the user spelled the email wrong the first time or didn't click on
	 * the link within 24 hours.
	 *
	 * @param {Application/Context} ctx Koa context
	 */
	async sendConfirmationMail(ctx:Context) {

		const user = await ctx.models.User.findOne({ id: ctx.params.id }).exec();

		if (!user) {
			throw new ApiError('No such user').status(404);
		}
		if (user.email_status.code === 'confirmed') {
			throw new ApiError('Cannot re-send confirmation mail to already confirmed address.').status(400);
		}
		user.email_status.token = randomString.generate(16);
		user.email_status.expires_at = new Date(new Date().getTime() + 86400000); // 1d valid

		await user.save();
		await registrationConfirmation(user);

		return this.success(ctx, null, 200);
	};
}