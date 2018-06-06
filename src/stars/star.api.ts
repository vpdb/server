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
import { MetricsDocument, Model } from 'mongoose';

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { ApiError } from '../common/api.error';
import { LogEventUtil } from '../log-event/log.event.util';
import { Star } from './star';
import { apiCache } from '../common/api.cache';

export class StarApi extends Api {

	private readonly models: { [key: string]: { model: string, titleAttr?: string, populate?: string } };

	constructor() {
		super();
		this.models = {
			release: { model: 'Release', titleAttr: 'name', populate: '_game' },
			game: { model: 'Game', titleAttr: 'title' },
			user: { model: 'User', titleAttr: 'email' },
			backglass: { model: 'Backglass' },
			medium: { model: 'Medium' }
		};
	}

	/**
	 * Stars an entity.
	 *
	 * @see POST /v1/releases/:id/star
	 * @param {string} name Name of the model
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public star(name: StarrableModel) {
		const model = this.models[name];
		if (!model) {
			throw new Error('Unknown model "' + name + '".');
		}
		return async (ctx: Context) => this._star(ctx, name, this.find(state.models[model.model] as  Model<MetricsDocument>, name, model.populate));
	}

	/**
	 * Unstars an entity.
	 *
	 * @see DELETE /v1/releases/:id/star
	 * @param {string} name Name of the model
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public unstar(name: StarrableModel) {
		const model = this.models[name];
		if (!model) {
			throw new Error('Unknown model "' + name + '".');
		}
		return async (ctx: Context) => this._unstar(ctx, name, this.find(state.models[model.model] as  Model<MetricsDocument>, name, model.populate));
	}

	/**
	 * Checks if an entity is starred.
	 *
	 * @see GET /v1/releases/:id/star
	 * @param {string} name Name of the model
	 * @return {(ctx: Context) => Promise<void>}
	 */
	public get(name: StarrableModel) {
		const model = this.models[name];
		if (!model) {
			throw new Error('Unknown model "' + name + '".');
		}
		return async (ctx: Context) => this._view(ctx, this.find(state.models[model.model] as  Model<MetricsDocument>, name), model.titleAttr || 'id');
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
	private async _view(ctx: Context, find: (ctx: Context) => Promise<[MetricsDocument, Star]>, titleAttr: string) {
		const [entity, star] = await find(ctx);
		if (star) {
			return this.success(ctx, pick(star, ['created_at']));
		} else {
			throw new ApiError('No star for <%s> for "%s" found.', ctx.state.user.email, (entity as any)[titleAttr]).status(404);
		}
	}

	/**
	 * Generic function for starring something.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} type Reference name
	 * @param {(ctx: Context) => Promise<[MetricsDocument, Star]>} find Find function
	 */
	private async _star(ctx: Context, type: string, find: (ctx: Context) => Promise<[MetricsDocument, Star]>) {

		const [entity, duplicateStar] = await find(ctx);
		if (duplicateStar) {
			throw new ApiError('Already starred. Cannot star twice, you need to unstar first.').warn().status(400);
		}
		const obj = {
			_from: ctx.state.user._id,
			_ref: { [type]: entity._id },
			type: type,
			created_at: new Date()
		};
		const star = new state.models.Star(obj);
		await star.save();
		await entity.incrementCounter('stars');

		// invalidate cache
		await apiCache.invalidate({ user: ctx.state.user }, { resources: [type] });
		await apiCache.invalidate({ user: ctx.state.user, entities: { release: entity.id } });

		await LogEventUtil.log(ctx, 'star_' + type, true, this.logPayload(entity, type), this.logRefs(star, entity, type));
		//pusher.star(type, entity, req.user);
		return this.success(ctx, { created_at: obj.created_at, total_stars: entity.counter.stars + 1 }, 201);
	}

	/**
	 * Generic function for unstarring something.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} type Reference name
	 * @param {(ctx: Context) => Promise<[MetricsDocument, Star]>} find Find function
	 */
	private async _unstar(ctx: Context, type: string, find: (ctx: Context) => Promise<[MetricsDocument, Star]>) {
		const [entity, star] = await find(ctx);
		if (!star) {
			throw new ApiError('Not starred. You need to star something before you can unstar it.').warn().status(400);
		}
		await star.remove();
		await entity.incrementCounter('stars', true);
		await LogEventUtil.log(ctx, 'unstar_' + type, true, this.logPayload(entity, type), this.logRefs(star, entity, type));

		// invalidate cache
		await apiCache.invalidate({ user: ctx.state.user }, { resources: [type] });
		await apiCache.invalidate({ user: ctx.state.user, entities: { release: entity.id } });
		//pusher.unstar(type, entity, req.user);
	}

	/**
	 * Returns entity and star for a given type.
	 *
	 * @param {Model} model Entity model
	 * @param {string} type Reference name
	 * @param {string} [populate] Entity population
	 * @return {(ctx: Context) => Promise<[MetricsDocument, Star]>} Function returning Entity and star
	 */
	private find(model: Model<MetricsDocument>, type: string, populate?: string) {
		return async (ctx: Context): Promise<[MetricsDocument, Star]> => {
			const query = model.findOne({ id: ctx.params.id });
			if (populate) {
				query.populate(populate);
			}
			const entity = await query.exec();
			if (!entity) {
				throw new ApiError('No such %s with ID "%s"', type, ctx.params.id).status(404);
			}
			const q = {
				['_ref.' + type]: entity._id,
				_from: ctx.state.user._id,
				type: type
			};
			const star = await state.models.Star.findOne(q);
			return [entity, star];
		};
	}

	private logPayload(entity:MetricsDocument, type:string) {
		const payload: any = {};
		payload[type] = entity.toObject();
		return payload;
	}

	private logRefs(star:any, entity:any, type:string) {
		const ref: any = {};
		ref[type] = star._ref[type]._id || star._ref[type];
		if (type === 'release') {
			ref.game = entity._game._id;
		}
		return ref;
	}
}

export type StarrableModel = 'release' | 'game' | 'user' | 'backglass' | 'medium';