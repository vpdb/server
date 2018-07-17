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

import { assign, pick } from 'lodash';
import { Types } from 'mongoose';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { ipdb } from '../common/ipdb';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { Context } from '../common/typings/context';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { UserDocument } from '../users/user.document';

export class GameRequestApi extends Api {

	/**
	 * Creates a new game request.
	 *
	 * @see POST /v1/game_requests
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const now = new Date();
		let ipdbNumber: number;

		// validate ipdb number syntax
		if (!ctx.request.body.ipdb_number) {
			throw new ApiError().validationError('ipdb_number', 'IPDB number must be provided', ctx.request.body.ipdb_number);
		}
		if (!/^\d+$/.test(ctx.request.body.ipdb_number.toString())) {
			throw new ApiError().validationError('ipdb_number', 'Must be a whole number', ctx.request.body.ipdb_number);
		}

		ipdbNumber = parseInt(ctx.request.body.ipdb_number, 10);
		const game = await state.models.Game.findOne({ 'ipdb.number': ipdbNumber }).exec();

		// check if game already exists
		if (game) {
			throw new ApiError().validationError('ipdb_number', 'Game with IPDB number ' + ipdbNumber + ' (' + game.title + ') is already in the database!', ipdbNumber);
		}
		const dupeGameRequest = await state.models.GameRequest.findOne({ ipdb_number: ipdbNumber }).exec();

		// check if game request already exists
		if (dupeGameRequest) {
			if (dupeGameRequest.is_closed) {
				throw new ApiError('Validation error').validationError('ipdb_number', 'This IPDB number has already been requested and closed for the following reason: ' + dupeGameRequest.message, ipdbNumber);
			} else {
				throw new ApiError('Validation error').validationError('ipdb_number', 'This IPDB number has already been requested. Please bear with us until we close this request.', ipdbNumber);
			}
		}

		// fetch details
		let ipdbData;
		try {
			ipdbData = await ipdb.details(ipdbNumber, { offline: ctx.query.ipdb_dryrun });
		} catch (err) {
			throw new ApiError('Error retrieving data from IPDB').validationError('ipdb_number', err.message, ipdbNumber);
		}

		let gameRequest = new state.models.GameRequest({
			title: ctx.request.body.title,
			notes: ctx.request.body.notes,
			ipdb_number: ipdbNumber,
			ipdb_title: ipdbData.title,
			is_closed: false,
			_created_by: ctx.state.user._id,
			created_at: now,
		});
		gameRequest = await gameRequest.save();

		await LogEventUtil.log(ctx, 'create_game_request', false, {
			game_request: pick(state.serializers.GameRequest.simple(ctx, gameRequest), ['id', 'title', 'ipdb_number', 'ipdb_title']),
		}, {
			game_request: gameRequest._id,
		});
		return this.success(ctx, state.serializers.GameRequest.simple(ctx, gameRequest), 201);
	}

	/**
	 * Updates a game request.
	 *
	 * @see PATCH /v1/game_requests/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['is_closed', 'message'];

		let requestClosed = false;
		let gameRequest = await state.models.GameRequest
			.findOne({ id: ctx.params.id })
			.populate('_created_by')
			.exec();

		if (!gameRequest) {
			throw new ApiError('No such game request with ID "%s".', ctx.params.id).status(404);
		}
		const user = gameRequest._created_by;

		// fail if invalid fields provided
		this.assertFields(ctx, updatableFields);

		const before = pick(gameRequest, updatableFields);
		if (gameRequest.is_closed === false && ctx.request.body.is_closed === true) {
			if (!ctx.request.body.message) {
				throw new ApiError().validationError('message', 'Message must be set when closing game request so the user can be notified', ctx.request.body.message);
			}
			requestClosed = true;
		}
		assign(gameRequest, ctx.request.body);
		gameRequest = await gameRequest.save();

		await LogEventUtil.log(ctx, 'update_game_request', false, {
			game_request: pick(state.serializers.GameRequest.simple(ctx, gameRequest), ['id', 'title', 'ipdb_number', 'ipdb_title']),
			before,
			after: pick(gameRequest, updatableFields),
		}, {
			game_request: gameRequest._id,
		});

		if (requestClosed) {
			await mailer.gameRequestDenied(user as UserDocument, gameRequest.ipdb_title, gameRequest.message);
		}
		return this.success(ctx, state.serializers.GameRequest.simple(ctx, gameRequest), 200);
	}

	/**
	 * Lists all game requests.
	 *
	 * @see GET /v1/game_requests
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {
		const statusValues = ['open', 'closed', 'denied', 'all'];
		const status = ctx.query.status || 'open';
		if (!statusValues.includes(status)) {
			throw new ApiError('Invalid status "' + status + '". Valid statuses are: [ ' + statusValues.join(', ') + ' ].');
		}
		let query;
		switch (status) {
			case 'open': query = { is_closed: false }; break;
			case 'closed': query = { is_closed: true }; break;
			case 'denied': query = { is_closed: true, _game: null }; break;
			case 'all': query = {}; break;
		}
		const requests = await state.models.GameRequest.find(query)
			.populate({ path: '_created_by' })
			.populate({ path: '_game' })
			.exec();
		return this.success(ctx, requests.map(r => state.serializers.GameRequest.detailed(ctx, r)));
	}

	/**
	 * Deletes a game request.
	 *
	 * @see DELETE /v1/game_requests/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const canDelete = await acl.isAllowed(ctx.state.user.id, 'game_requests', 'delete');
		const gameRequest = await state.models.GameRequest.findOne({ id: ctx.params.id }).exec();
		if (!gameRequest) {
			throw new ApiError('No such game request with ID "%s".', ctx.params.id).status(404);
		}

		// only allow deleting own game requests
		if (!canDelete && !(gameRequest._created_by as Types.ObjectId).equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}
		// remove from db
		await gameRequest.remove();
		logger.info('[GameRequestApi.del] Game Request "%s" successfully deleted.', gameRequest.id);

		await LogEventUtil.log(ctx, 'delete_game_request', false, {
			game_request: pick(state.serializers.GameRequest.simple(ctx, gameRequest), ['id', 'title', 'ipdb_number', 'ipdb_title']),
		}, {
			game_request: gameRequest._id,
		});
		return this.success(ctx, null, 204);
	}
}
