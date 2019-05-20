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

import { compact, isUndefined, map } from 'lodash';
import sanitize = require('mongo-sanitize');

import { inspect } from 'util';
import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { Context } from '../common/typings/context';
import { state } from '../state';
import { LogEventDocument } from './log.event.document';

export class LogEventApi extends Api {

	/**
	 * Lists all events related to a user.
	 *
	 * @see GET /v1/events
	 * @see GET /v1/releases/:id/events
	 * @see GET /v1/profile/events
	 * @see GET /v1/games/:id/events
	 */
	public list(opts: ListLogEventOpts = {}) {

		return async (ctx: Context) => {

			const query: any = [{ is_public: true }];
			const pagination = this.pagination(ctx, 10, 50);

			let emptyResult = false;

			// filter event
			if (ctx.query.events) {
				const events: string[] = ctx.query.events.split(',');
				const eventsIn: string[] = [];
				const eventsNin: string[] = [];
				events.forEach(event => {
					if (event[0] === '!') {
						eventsNin.push(event.substr(1));
					} else {
						eventsIn.push(event);
					}
				});
				if (eventsIn.length > 0) {
					query.push({ event: { $in: eventsIn } });
				}
				if (eventsNin.length > 0) {
					query.push({ event: { $nin: eventsNin } });
				}
			}

			// user
			if (opts.loggedUser) {
				query.push({ _actor: ctx.state.user._id });
			}

			// by game
			if (opts.byGame && ctx.params.id) {
				const game = await state.models.Game.findOne({ id: sanitize(ctx.params.id) }).exec();
				if (!game) {
					throw new ApiError('No such game with id %s.', ctx.params.id).status(404);
				}
				query.push({ '_ref.game': game._id });
			}

			// by release
			if (opts.byRelease && ctx.params.id) {
				const release = await state.models.Release.findOne({ id: sanitize(ctx.params.id) }).populate('_game').exec();
				if (!release) {
					throw new ApiError('No such release with id %s.', ctx.params.id).status(404);
				}
				await release.assertRestrictedView(ctx);
				query.push({ '_ref.release': release._id });
			}

			// starred events
			if (!isUndefined(ctx.query.starred)) {
				if (!ctx.state.user) {
					throw new ApiError('Must be logged when listing starred events.').status(401);
				}

				const stars = await state.models.Star.find({ _from: ctx.state.user._id }).exec();

				const releaseIds = compact(map(map(stars, '_ref'), 'release'));
				const gameIds = compact(map(map(stars, '_ref'), 'game'));

				const or = [];
				if (releaseIds.length > 0) {
					or.push({ '_ref.release': { $in: releaseIds } });
				}
				if (gameIds.length > 0) {
					or.push({ '_ref.game': { $in: gameIds } });
				}
				if (or.length > 0) {
					query.push({ $or: or });

				} else {
					// return empty result (nothing starred)
					emptyResult = true;
				}
			}

			// check for full details permission
			let fullDetails = false;
			if (ctx.state.user) {
				fullDetails = await acl.isAllowed(ctx.state.user.id, 'users', 'full-details');
			}

			// by actor
			if (opts.byActor && ctx.params.id) {

				// check access
				if (!fullDetails) {
					throw new ApiError('Access denied.').status(401);
				}
				const user = await state.models.User.findOne({ id: sanitize(ctx.params.id) }).exec();
				if (!user) {
					throw new ApiError('No such user with id %s.', ctx.params.id).status(404);
				}
				query.push({ _actor: user._id });
			}
			logger.info(ctx.state, '[LogEventApi.list] Events query: %s', inspect(query, { depth: null }));

			let docs: LogEventDocument[] = [];
			let count = 0;

			// don't bother querying if a previous selection came up empty
			if (!emptyResult) {
				// query
				const result = await state.models.LogEvent.paginate(this.searchQuery(query), {
					page: pagination.page,
					limit: pagination.perPage,
					sort: { logged_at: -1 },
					populate: ['_actor'],

				});
				docs = result.docs;
				count = result.total;
			}

			const logs = docs.map(log => fullDetails ? state.serializers.LogEvent.detailed(ctx, log) : state.serializers.LogEvent.simple(ctx, log));
			this.success(ctx, logs, 200, this.paginationOpts(pagination, count));
		};
	}
}

export interface ListLogEventOpts {
	loggedUser?: boolean;
	byGame?: boolean;
	byRelease?: boolean;
	byActor?: boolean;
}
