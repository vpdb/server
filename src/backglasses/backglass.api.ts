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

import { cloneDeep, difference, extend, intersection, isArray, isUndefined, keys, pick } from 'lodash';
import { Types } from 'mongoose';
import { inspect } from 'util';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { SerializerOptions } from '../common/serializer';
import { Context } from '../common/typings/context';
import { Game } from '../games/game';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { User } from '../users/user';
import { Backglass } from './backglass';

export class BackglassApi extends Api {

	/**
	 * Creates a new backglass.
	 *
	 * @see POST /v1/backglasses
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const now = new Date();

		const backglass = await state.models.Backglass.getInstance(extend(ctx.request.body, {
			_created_by: ctx.state.user._id,
			created_at: now,
		}));

		if (isArray(backglass.versions)) {
			backglass.versions.forEach(version => {
				if (!version.released_at) {
					version.released_at = now;
				}
			});

			// if this comes from /games/:gameId/backglasses, we already have a game id.
			if (ctx.params.gameId) {
				const game = await state.models.Game.findOne({ id: ctx.params.gameId }).exec();
				if (!game) {
					throw new ApiError('No such game with ID "%s".', ctx.params.gameId).status(404);
				}
				backglass._game = game._id;
			}

			// check for available rom
			if (backglass.versions[0] && !backglass._game) {
				let backglassFile;
				const file = await state.models.File.findById(backglass.versions[0]._file).exec();
				if (file && file.metadata && file.metadata.gamename) {
					backglassFile = file;
					const rom = await state.models.Rom.findOne({ id: file.metadata.gamename }).exec();
					if (rom) {
						logger.info('[ctrl|backglass] Linking backglass to same game %s as rom "%s".', rom._game, backglassFile.metadata.gamename);
						backglass._game = rom._game;
					}
				}
			}
		}
		await backglass.save();
		logger.info('[BackglassApi.create] Backglass "%s" successfully created.', backglass.id);
		await backglass.activateFiles();

		const populatedBackglass = await state.models.Backglass.findById(backglass._id)
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions._file' })
			.populate({ path: '_created_by' })
			.exec();

		// send moderation mail
		if (populatedBackglass.moderation.is_approved) {
			await mailer.backglassAutoApproved(ctx.state.user, populatedBackglass);
		} else {
			await mailer.backglassSubmitted(ctx.state.user, populatedBackglass);
		}

		// event log
		await LogEventUtil.log(ctx, 'create_backglass', true, {
			backglass: state.serializers.Backglass.detailed(ctx, populatedBackglass),
			game: state.serializers.Game.reduced(ctx, populatedBackglass._game as Game),
		}, {
			backglass: populatedBackglass._id,
			game: populatedBackglass._game._id,
		});

		// return object
		return this.success(ctx, state.serializers.Backglass.detailed(ctx, populatedBackglass), 201);
	}

	/**
	 * Updates a backglass.
	 *
	 * @see PATCH /v1/backglasses/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['_game', 'description', 'acknowledgements'];

		let backglass = await state.models.Backglass.findOne({ id: ctx.params.id }).exec();

		// fail if invalid id
		if (!backglass) {
			throw new ApiError('No such backglass with ID "%s".', ctx.params.id).status(404).log();
		}

		// check for global update permissions
		const canUpdate = await acl.isAllowed(ctx.state.user.id, 'backglasses', 'update');

		// if user only has permissions to update own releases, check if owner.
		if (!canUpdate) {
			// fail if wrong user
			const authorIds = backglass.authors.map(a => a._user.toString());
			const creatorId = backglass._created_by.toString();
			if (![creatorId, ...authorIds].includes(ctx.state.user._id.toString())) {
				throw new ApiError('Only authors, uploader or moderators can update a backglass.').status(403).log();
			}
			if (!isUndefined(ctx.request.body.authors) && creatorId !== ctx.state.user._id.toString()) {
				throw new ApiError('Only the original uploader can edit authors.').status(403).log();
			}
		}

		// fail if invalid fields provided
		const submittedFields = keys(ctx.request.body);
		if (intersection(updatableFields, submittedFields).length !== submittedFields.length) {
			const invalidFields = difference(submittedFields, updatableFields);
			throw new ApiError('Invalid field%s: ["%s"]. Allowed fields: ["%s"]', invalidFields.length === 1 ? '' : 's', invalidFields.join('", "'), updatableFields.join('", "')).status(400).log();
		}
		const oldBackglass = cloneDeep(backglass) as Backglass;

		// apply changes
		backglass = await backglass.updateInstance(ctx.request.body);

		// validate and save
		await backglass.save();

		// re-fetch backglass object tree
		backglass = await state.models.Backglass.findById(backglass._id)
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions._file' })
			.populate({ path: '_created_by' })
			.exec();

		// log event
		await LogEventUtil.log(ctx, 'update_backglass', false, LogEventUtil.diff(oldBackglass, ctx.request.body),
			{ backglass: backglass._id, game: backglass._game._id });

		return this.success(ctx, state.serializers.Backglass.detailed(ctx, backglass), 200);
	}

	/**
	 * Lists all backglasses.
	 *
	 * @see GET /v1/backglasses
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {
		let query: any = {};
		const pagination = this.pagination(ctx, 10, 30);
		const serializerOpts: SerializerOptions = {};
		const fields = ctx.query && ctx.query.fields ? ctx.query.fields.split(',') : [];
		const populate = ['authors._user', 'versions._file'];
		let game: Game;
		// list roms of a game below /api/v1/games/{gameId}
		if (ctx.params.gameId) {
			game = await state.models.Game.findOne({ id: ctx.params.gameId }).exec();
		} else if (ctx.query.game_id) {
			// filter with game_id query parameter
			game = await state.models.Game.findOne({ id: ctx.query.game_id }).exec();
		}

		if (!game) {
			if (ctx.params.gameId) {
				throw new ApiError('No such game with ID "%s".', ctx.params.gameId).status(404);
			}
			if (ctx.query.game_id) {
				throw new ApiError('No such game with ID "%s".', ctx.query.game_id).status(404);
			}
			populate.push('_game');
		} else {
			query._game = game._id;
		}

		// validate moderation field
		if (fields.includes('moderation')) {
			if (!ctx.state.user) {
				throw new ApiError('You must be logged in order to fetch moderation fields.').status(403);
			}
			const isModerator = await acl.isAllowed(ctx.state.user.id, 'backglasses', 'moderate');
			if (!isModerator) {
				throw new ApiError('You must be moderator in order to fetch moderation fields.').status(403);
			}
			serializerOpts.includedFields = ['moderation'];
		}
		query = await state.models.Backglass.handleGameQuery(ctx, await state.models.Backglass.handleModerationQuery(ctx, query));

		logger.info('[BackglassApi.list] query: %s', inspect(query, { depth: null }));

		const result = await state.models.Backglass.paginate(query, {
			page: pagination.page,
			limit: pagination.perPage,
			populate,
			sort: { created_at: -1 },
		});
		const backglasses = result.docs.map(bg => state.serializers.Backglass.simple(ctx, bg, serializerOpts));
		return this.success(ctx, backglasses, 200, this.paginationOpts(pagination, result.total));
	}

	/**
	 * Returns details about a backglass.
	 *
	 * @see GET /v1/backglasses/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {
		const serializerOpts: SerializerOptions = {
			fields: [],
		};
		let backglass = await state.models.Backglass.findOne({ id: ctx.params.id })
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions._file' })
			.populate({ path: '_created_by' })
			.exec();
		if (!backglass) {
			throw new ApiError('No such backglass with ID "%s"', ctx.params.id).status(404);
		}
		const isModerator = ctx.state.user ? (await acl.isAllowed(ctx.state.user.id, 'backglasses', 'moderate')) : false;

		if (!isModerator && (backglass._game as Game).isRestricted('backglass') && !backglass.isCreatedBy(ctx.state.user)) {
			throw new ApiError('No such backglass with ID "%s"', ctx.params.id).status(404);
		}
		backglass = await backglass.assertModeratedView(ctx);
		const fields = ctx.query && ctx.query.fields ? ctx.query.fields.split(',') : [];
		const populated = await backglass.populateModeration(ctx, { includedFields: fields });
		if (populated !== false) {
			serializerOpts.includedFields = ['moderation'];
		}
		return this.success(ctx, state.serializers.Backglass.detailed(ctx, populated as Backglass, serializerOpts));
	}

	/**
	 * Deletes a backglass.
	 *
	 * @see DELETE /v1/backglasses/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const canDelete = await acl.isAllowed(ctx.state.user.id, 'backglasses', 'delete');
		const backglass = await state.models.Backglass.findOne({ id: ctx.params.id })
			.populate({ path: '_game' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions._file' })
			.exec();
		if (!backglass) {
			throw new ApiError('No such backglass with ID "%s".', ctx.params.id).status(404);
		}
		// only allow deleting own roms
		if (!canDelete && !(backglass._created_by as Types.ObjectId).equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}
		// remove from db
		await backglass.remove();
		logger.info('[BackglassApi.delete] Backglass "%s" successfully deleted.', backglass.id);

		// event log
		await LogEventUtil.log(ctx, 'delete_backglass', false, {
			backglass: pick(state.serializers.Backglass.detailed(ctx, backglass), ['id', 'authors', 'versions']),
			game: state.serializers.Game.simple(ctx, backglass._game as Game),
		}, {
			backglass: backglass._id,
			game: backglass._game._id,
		});
		return this.success(ctx, null, 204);
	}

	/**
	 * Moderates a backglass.
	 *
	 * @see POST /v1/backglasses/:id/moderate
	 * @param {Context} ctx Koa context
	 */
	public async moderate(ctx: Context) {
		let backglass = await state.models.Backglass.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();
		if (!backglass) {
			throw new ApiError('No such backglass with ID "%s".', ctx.params.id).status(404);
		}
		const moderationEvent = await state.models.Backglass.handleModeration(ctx, backglass);
		switch (moderationEvent.event) {
			case 'approved':
				await mailer.backglassApproved(backglass._created_by as User, backglass, moderationEvent.message);
				break;
			case 'refused':
				await mailer.backglassRefused(backglass._created_by as User, backglass, moderationEvent.message);
				break;
		}
		backglass = await state.models.Backglass.findById(backglass._id)
			.populate('moderation.history._created_by')
			.exec();
		return this.success(ctx, state.serializers.Backglass.detailed(ctx, backglass, { includedFields: ['moderation'] }).moderation, 200);
	}
}
