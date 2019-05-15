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

import { extend } from 'lodash';
import { Types } from 'mongoose';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { Context } from '../common/typings/context';
import { state } from '../state';

export class MediumApi extends Api {

	/**
	 * Creates a new medium.
	 *
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const now = new Date();
		const medium = await state.models.Medium.getInstance(ctx.state, extend(ctx.request.body, {
			_created_by: ctx.state.user._id,
			created_at: now,
		}));
		await medium.save();
		logger.info(ctx.state, '[MediumApi.create] Medium "%s" successfully created.', medium.id);
		await medium.activateFiles();
		const populatedMedium = await state.models.Medium.findById(medium._id)
			.populate({ path: '_ref.game' })
			.populate({ path: '_ref.release' })
			.populate({ path: '_created_by' })
			.populate({ path: '_file' })
			.exec();
		this.success(ctx, state.serializers.Medium.simple(ctx, populatedMedium), 201);
	}

	/**
	 * Lists all media.
	 *
	 * Currently, this is only used under /games/{game_id}/media, so params.gameId is mandatory.
	 *
	 * @see GET /v1/games/:gameId/media
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		const game = await state.models.Game.findOne({ id: ctx.params.gameId }).exec();
		if (!game) {
			throw new ApiError('Unknown game "%s".', ctx.params.gameId).status(404);
		}
		const media = await state.models.Medium.find({ '_ref.game': game._id })
			.populate({ path: '_created_by' })
			.populate({ path: '_file' })
			.exec();
		this.success(ctx, media.map(m => state.serializers.Medium.simple(ctx, m)));
	}

	/**
	 * Deletes a medium.
	 *
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const canDelete = await acl.isAllowed(ctx.state.user.id, 'media', 'delete');
		const medium = await state.models.Medium.findOne({ id: ctx.params.id }).exec();
		if (!medium) {
			throw new ApiError('No such medium with ID "%s".', ctx.params.id).status(404);
		}

		// only allow deleting own roms
		if (!canDelete && !(medium._created_by as Types.ObjectId).equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}

		// remove from db
		await medium.remove();

		// invalidate cache
		if (medium._ref.game) {
			await apiCache.invalidateUpdatedGame(ctx.state, await state.models.Game.findById(medium._ref.game));
		}

		logger.info(ctx.state, '[MediumApi.del] Medium "%s" successfully deleted.', medium.id);
		this.success(ctx, null, 204);
	}
}
