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

import { pick } from 'lodash';
import { MetricsDocument, Model } from 'mongoose';

import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { StarDocument } from './star.document';

export class StarApi extends Api {

	private readonly models: { [key: string]: { model: string, titleAttr?: string, populate?: string } };

	constructor() {
		super();
		this.models = {
			release: { model: 'Release', titleAttr: 'name', populate: '_game' },
			game: { model: 'Game', titleAttr: 'title' },
			user: { model: 'User', titleAttr: 'email' },
			backglass: { model: 'Backglass' },
			medium: { model: 'Medium' },
		};
	}

	/**
	 * Stars an entity.
	 *
	 * @see POST /v1/releases/:id/star
	 * @see POST /v1/backglasses/:id/star
	 * @see POST /v1/games/:id/star
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public star(modelName: StarrableModel) {
		const model = this.models[modelName];
		/* istanbul ignore next */
		if (!model) {
			throw new Error('Unknown model "' + modelName + '".');
		}
		return async (ctx: Context) => this._star(ctx, modelName, this.find(state.getModel<Model<MetricsDocument>>(model.model), modelName, model.populate));
	}

	/**
	 * Unstars an entity.
	 *
	 * @see DELETE /v1/releases/:id/star
	 * @see DELETE /v1/backglasses/:id/star
	 * @see DELETE /v1/games/:id/star
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public unstar(modelName: StarrableModel) {
		const model = this.models[modelName];
		/* istanbul ignore next */
		if (!model) {
			throw new Error('Unknown model "' + modelName + '".');
		}
		return async (ctx: Context) => this._unstar(ctx, modelName, this.find(state.getModel<Model<MetricsDocument>>(model.model), modelName, model.populate));
	}

	/**
	 * Checks if an entity is starred.
	 *
	 * @see GET /v1/releases/:id/star
	 * @see GET /v1/backglasses/:id/star
	 * @see GET /v1/games/:id/star
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public get(modelName: StarrableModel) {
		const model = this.models[modelName];
		/* istanbul ignore next */
		if (!model) {
			throw new Error('Unknown model "' + modelName + '".');
		}
		return async (ctx: Context) => this._view(ctx, this.find(state.getModel<Model<MetricsDocument>>(model.model), modelName), model.titleAttr || 'id');
	}

	/**
	 * Generic function for viewing a star.
	 *
	 * @param {Context} ctx Koa context
	 * @param {(ctx: Context) => Promise<[MetricsDocument, Star]>} find Find function
	 * @param {string} titleAttr Attribute name of the document's title, for logging purpose
	 * @return {Promise<boolean>}
	 * @private
	 */
	private async _view(ctx: Context, find: (ctx: Context) => Promise<[MetricsDocument, StarDocument]>, titleAttr: string) {
		const [entity, star] = await find(ctx);
		if (star) {
			this.success(ctx, pick(star, ['created_at']));
		} else {
			throw new ApiError('No star for <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
	}

	/**
	 * Generic function for starring something.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {(ctx: Context) => Promise<[MetricsDocument, Star]>} find Find function
	 */
	private async _star(ctx: Context, modelName: string, find: (ctx: Context) => Promise<[MetricsDocument, StarDocument]>) {

		const [entity, duplicateStar] = await find(ctx);
		if (duplicateStar) {
			throw new ApiError('Already starred. Cannot star twice, you need to unstar first.').warn().status(400);
		}
		const obj = {
			_from: ctx.state.user._id,
			_ref: { [modelName]: entity._id },
			type: modelName,
			created_at: new Date(),
		};
		const star = new state.models.Star(obj);
		await star.save();
		await entity.incrementCounter('stars');

		await LogEventUtil.log(ctx, 'star_' + modelName, true, this.logPayload(entity, modelName), this.logRefs(star, entity, modelName));

		// invalidate cache for user
		await apiCache.invalidateStarredEntity(ctx.state, modelName, entity, ctx.state.user);

		this.success(ctx, { created_at: obj.created_at, total_stars: entity.counter.stars + 1 }, 201);
	}

	/**
	 * Generic function for unstarring something.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {(ctx: Context) => Promise<[MetricsDocument, Star]>} find Find function
	 */
	private async _unstar(ctx: Context, modelName: string, find: (ctx: Context) => Promise<[MetricsDocument, StarDocument]>) {
		const [entity, star] = await find(ctx);
		if (!star) {
			throw new ApiError('Not starred. You need to star something before you can unstar it.').warn().status(400);
		}
		await star.remove();
		await entity.incrementCounter('stars', -1);
		await LogEventUtil.log(ctx, 'unstar_' + modelName, true, this.logPayload(entity, modelName), this.logRefs(star, entity, modelName));

		// invalidate cache for user
		await apiCache.invalidateStarredEntity(ctx.state, modelName, entity, ctx.state.user);

		this.success(ctx, null, 204);
	}

	/**
	 * Returns entity and star for a given type.
	 *
	 * @param {Model} model Entity model
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} [populate] Entity population
	 * @return {(ctx: Context) => Promise<[MetricsDocument, Star]>} Function returning Entity and star
	 */
	private find(model: Model<MetricsDocument>, modelName: string, populate?: string) {
		return async (ctx: Context): Promise<[MetricsDocument, StarDocument]> => {
			const query = model.findOne({ id: ctx.params.id });
			if (populate) {
				query.populate(populate);
			}
			const entity = await query.exec();
			if (!entity) {
				throw new ApiError('No such %s with ID "%s"', modelName, ctx.params.id).status(404);
			}
			const q = {
				['_ref.' + modelName]: entity._id,
				_from: ctx.state.user._id,
				type: modelName,
			};
			const star = await state.models.Star.findOne(q);
			return [entity, star];
		};
	}

	private logPayload(entity: MetricsDocument, type: string) {
		const payload: any = {};
		payload[type] = entity.toObject();
		return payload;
	}

	private logRefs(star: any, entity: any, type: string) {
		const ref: any = {};
		ref[type] = star._ref[type]._id;
		if (type === 'release') {
			ref.game = entity._game._id;
		}
		return ref;
	}
}

export type StarrableModel = 'release' | 'game' | 'user' | 'backglass' | 'medium';
