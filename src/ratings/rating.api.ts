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

import { pick } from 'lodash';
import { Model, Document } from 'mongoose';

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { ApiError } from '../common/api.error';
import { metrics } from '../common/metrics';
import { logger } from '../common/logger';
import { LogEventUtil } from '../log-event/log.event.util';
import { Rating } from './rating';

export class RatingApi extends Api {

	public async createForGame(ctx: Context) {
		return await this.create(ctx, 'game', this.find(state.models.Game, 'game'));
	};

	public async getForGame(ctx: Context) {
		return await this.view(ctx, this.find(state.models.Game, 'game'), 'title');
	};

	public async updateForGame(ctx: Context) {
		return await this.update(ctx, 'game', this.find(state.models.Game, 'game'), 'title');
	};

	public async createForRelease(ctx: Context) {
		return await  this.create(ctx, 'release', this.find(state.models.Release, 'release', '_game'));
	};

	public async getForRelease(ctx: Context) {
		return await this.view(ctx, this.find(state.models.Release, 'release'), 'name');
	};

	public async updateForRelease(ctx: Context) {
		return await this.update(ctx, 'release', this.find(state.models.Release, 'release', '_game'), 'name');
	};

	/**
	 * Generic function for viewing a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 * @param {string} titleAttr Attribute of the entity that contains a title
	 */
	private async view(ctx: Context, find: (ctx: Context) => Promise<[Document, Rating]>, titleAttr: string) {
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
	 * @param {string} ref Reference name
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 */
	private async create(ctx: Context, ref: string, find: (ctx: Context) => Promise<[Document, Rating]>) {
		const [entity, duplicateRating] = await find(ctx);
		if (duplicateRating) {
			throw new ApiError('Cannot vote twice. Use PUT in order to update a vote.').warn().status(400);
		}
		const obj = {
			_from: ctx.state.user._id,
			_ref: { [ref]: entity._id },
			value: ctx.body.value,
			created_at: new Date()
		};
		const rating = new state.models.Rating(obj);
		await rating.save();
		await this.updateRatedEntity(ctx, ref, entity, rating, 201);
	}

	/**
	 * Generic function for updating a rating.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} ref Reference name
	 * @param {(ctx: Context) => Promise<[Document, Rating]>} find Function that returns entity and rating.
	 * @param {string} titleAttr Attribute of the entity that contains a title
	 */
	private async update(ctx: Context, ref: string, find: (ctx: Context) => Promise<[Document, Rating]>, titleAttr: string) {
		const [entity, rating] = await find(ctx);
		if (!rating) {
			throw new ApiError('No rating of <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
		rating.value = ctx.body.value;
		rating.modified_at = new Date();
		await rating.save();
	}

	/**
	 * Updates an entity with new rating data and returns the result.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} ref Reference name
	 * @param entity Found entity
	 * @param {Rating} rating New rating
	 * @param {number} status Success status, either 200 or 201
	 * @return {Promise<boolean>}
	 */
	private async updateRatedEntity(ctx: Context, ref: string, entity: any, rating: Rating, status: number) {
		const result = await metrics.onRatingUpdated(ref, entity, rating);

		// if not 201, add modified date
		if (status === 200) {
			result.modified_at = rating.modified_at;
			logger.info('[RatingApi.updateRatedEntity] User <%s> updated rating for %s %s to %s.', ctx.state.user, ref, entity.id, rating.value);
		} else {
			logger.info('[RatingApi.updateRatedEntity] User <%s> added new rating for %s %s with %s.', ctx.state.user, ref, entity.id, rating.value);
		}
		await LogEventUtil.log(ctx, 'rate_' + ref, true, this.logPayload(rating, entity, ref, status === 200), this.logRefs(rating, entity, ref));
		return this.success(ctx, result, status);
	}

	/**
	 * Returns entity and rating for a given type.
	 *
	 * @param {Model<Document>} model Model that can be rated
	 * @param {string} ref Reference name
	 * @param {string} [populate] If set, populates additional fields.
	 * @return {(ctx: Context) => Promise<[Document, Rating]>} Function returning entity and rating
	 */
	private find(model: Model<Document>, ref: string, populate?: string) {
		return async (ctx: Context): Promise<[Document, Rating]> => {
			const query = model.findOne({ id: ctx.params.id });
			if (populate) {
				query.populate(populate);
			}
			const entity = await query.exec();
			if (!entity) {
				throw new ApiError('No such %s with ID "%s"', ref, ctx.params.id).status(404);
			}
			const q = {
				_from: ctx.state.user._id,
				['_ref.' + ref]: entity._id
			};
			const rating = await state.models.Rating.findOne(q);
			return [entity, rating];
		};
	}

	private async logPayload(rating: any, entity: any, type: string, updateOnly: boolean) {
		const payload: any = { rating: pick(rating.toObject(), ['id', 'value']), updated: updateOnly };
		payload[type] = entity.toObject();
		return payload;
	}

	private async logRefs(rating: any, entity: any, type: string) {
		const ref: any = {};
		ref[type] = rating._ref[type]._id || rating._ref[type];
		if (type === 'release') {
			ref.game = entity._game._id;
		}
		return ref;
	}
}
