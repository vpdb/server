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

import { pick } from 'lodash';
import { Document, Model } from 'mongoose';

import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { metrics } from '../common/metrics';
import { Context } from '../common/typings/context';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { RatingDocument } from './rating.document';

export class RatingApi extends Api {

	/**
	 * Adds a new rating for a game.
	 *
	 * @see POST /v1/games/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async createForGame(ctx: Context) {
		return this.create(ctx, 'game', this.find(state.models.Game, 'game'));
	}

	/**
	 * Retrieves the authenticated user's rating of a game.
	 *
	 * @see GET /v1/games/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async getForGame(ctx: Context) {
		return this.view(ctx, this.find(state.models.Game, 'game'), 'title');
	}

	/**
	 * Updates an existing rating of a game.
	 *
	 * @see PUT /v1/games/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async updateForGame(ctx: Context) {
		return this.update(ctx, 'game', this.find(state.models.Game, 'game'), 'title');
	}

	/**
	 * Deletes an existing rating of a game.
	 *
	 * @see DELETE /v1/games/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async deleteForGame(ctx: Context) {
		return this.del(ctx, 'game', this.find(state.models.Game, 'game'), 'title');
	}

	/**
	 * Creates a new rating for a release.
	 *
	 * @see POST /v1/releases/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async createForRelease(ctx: Context) {
		return this.create(ctx, 'release', this.find(state.models.Release, 'release', '_game'));
	}

	/**
	 * Retrieves the authenticated user's rating for a release.
	 *
	 * @see GET /v1/releases/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async getForRelease(ctx: Context) {
		return this.view(ctx, this.find(state.models.Release, 'release'), 'name');
	}

	/**
	 * Updates a rating for a release.
	 *
	 * @see PUT /v1/releases/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async updateForRelease(ctx: Context) {
		return this.update(ctx, 'release', this.find(state.models.Release, 'release', '_game'), 'name');
	}

	/**
	 * Updates a rating for a release.
	 *
	 * @see DELETE /v1/releases/:id/rating
	 * @param {Context} ctx Koa context
	 */
	public async deleteForRelease(ctx: Context) {
		return this.del(ctx, 'release', this.find(state.models.Release, 'release', '_game'), 'name');
	}

	/**
	 * Generic function for viewing a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 * @param {string} titleAttr Attribute of the entity that contains a title
	 */
	private async view(ctx: Context, find: (ctx: Context) => Promise<[Document, RatingDocument]>, titleAttr: string) {
		const [entity, rating] = await find(ctx);
		if (!rating) {
			throw new ApiError('No rating of <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
		return this.success(ctx, pick(rating, ['value', 'created_at', 'modified_at']));
	}

	/**
	 * Generic function for creating a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 */
	private async create(ctx: Context, modelName: string, find: (ctx: Context) => Promise<[Document, RatingDocument]>) {
		const [entity, duplicateRating] = await find(ctx);
		if (duplicateRating) {
			throw new ApiError('Cannot vote twice. Use PUT in order to update a vote.').warn().status(400);
		}
		const obj = {
			_from: ctx.state.user._id,
			_ref: { [modelName]: entity._id },
			value: ctx.request.body.value,
			created_at: new Date(),
		};
		const rating = new state.models.Rating(obj);
		await rating.save();
		await this.updateRatedEntity(ctx, modelName, entity, rating, 201);
	}

	/**
	 * Generic function for updating a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 * @param {string} titleAttr Attribute of the entity that contains a title
	 */
	private async update(ctx: Context, modelName: string, find: (ctx: Context) => Promise<[Document, RatingDocument]>, titleAttr: string) {
		const [entity, rating] = await find(ctx);
		if (!rating) {
			throw new ApiError('No rating of <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
		rating.value = ctx.request.body.value;
		rating.modified_at = new Date();
		await rating.save();

		await this.updateRatedEntity(ctx, modelName, entity, rating, 200);
	}

	/**
	 * Generic function for deleting a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 * @param {string} titleAttr Attribute of the entity that contains a title
	 */
	private async del(ctx: Context, modelName: string, find: (ctx: Context) => Promise<[Document, RatingDocument]>, titleAttr: string) {
		const [entity, rating] = await find(ctx);
		if (!rating) {
			throw new ApiError('No rating of <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
		await rating.remove();
		await this.updateRatedEntity(ctx, modelName, entity, null, 204);
	}

	/**
	 * Updates an entity with new rating data and returns the result.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param entity Found entity
	 * @param {RatingDocument} rating New rating
	 * @param {number} status Success status, either 200 or 201
	 * @return {Promise<boolean>}
	 */
	private async updateRatedEntity(ctx: Context, modelName: string, entity: any, rating: RatingDocument, status: number) {
		const result = await metrics.onRatingUpdated(modelName, entity, rating);

		// if not 201, add modified date
		if (status === 200) {
			result.modified_at = rating.modified_at;
			logger.info('[RatingApi.updateRatedEntity] User <%s> updated rating for %s %s to %s.', ctx.state.user, modelName, entity.id, rating.value);
		} else if (rating) {
			logger.info('[RatingApi.updateRatedEntity] User <%s> added new rating for %s %s with %s.', ctx.state.user, modelName, entity.id, rating.value);
		} else {
			logger.info('[RatingApi.updateRatedEntity] User <%s> removed rating for %s %s.', ctx.state.user, modelName, entity.id);
		}

		this.success(ctx, result, status);

		if (rating) {
			await LogEventUtil.log(ctx, 'rate_' + modelName, true, this.logPayload(rating, entity, modelName, status === 200), this.logRefs(rating, entity, modelName));
		} else {
			await LogEventUtil.log(ctx, 'unrate_' + modelName, true, this.logPayload(null, entity, modelName, false), this.logRefs(null, entity, modelName));
		}

		// invalidate cache
		await apiCache.invalidateEntity(modelName, entity.id);
	}

	/**
	 * Returns entity and rating for a given type.
	 *
	 * @param {Model<Document>} model Model that can be rated
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} [populate] If set, populates additional fields.
	 * @return {(ctx: Context) => Promise<[Document, Rating]>} Function returning entity and rating
	 */
	private find(model: Model<Document>, modelName: string, populate?: string) {
		return async (ctx: Context): Promise<[Document, RatingDocument]> => {
			const query = model.findOne({ id: ctx.params.id });
			if (populate) {
				query.populate(populate);
			}
			const entity = await query.exec();
			if (!entity) {
				throw new ApiError('No such %s with ID "%s"', modelName, ctx.params.id).status(404);
			}
			const q = {
				_from: ctx.state.user._id,
				['_ref.' + modelName]: entity._id,
			};
			const rating = await state.models.Rating.findOne(q);
			return [entity, rating];
		};
	}

	private async logPayload(rating: any, entity: any, modelName: string, updateOnly: boolean) {
		let payload: any;
		if (rating) {
			payload = { rating: pick(rating.toObject(), ['id', 'value']), updated: updateOnly };
		} else {
			payload = { deleted: true };
		}
		payload[modelName] = entity.toObject();
		return payload;
	}

	private async logRefs(rating: any, entity: any, modelName: string) {
		const ref: any = {};
		if (rating) {
			ref[modelName] = rating._ref[modelName]._id;
			if (modelName === 'release') {
				ref.game = entity._game._id;
			}
		}
		return ref;
	}
}
