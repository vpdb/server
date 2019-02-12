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

import { Api } from '../common/api';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { state } from '../state';

export class LogUserApi extends Api {

	/**
	 * Returns the current user's log.
	 *
	 * @see GET /v1/profile/logs
	 * @param ctx Koa context
	 */
	public async list(ctx: Context) {

		const pagination = this.pagination(ctx, 30, 100);
		const query: any = [{ _user: ctx.state.user._id, _actor: ctx.state.user._id }];

		// filter event
		if (ctx.query.event) {
			const events: string[] = ctx.query.event.split(',');
			const d = events.map(event => {
				return { event };
			});
			if (d.length === 1) {
				query.push(d[0]);
			} else {
				query.push({ $or: d });
			}
		}

		// query
		const result = await state.models.LogUser.paginate(this.searchQuery(query));
		const providerInfo: { [key: string]: { name: string, icon: string } } = {
			google: { name: 'Google', icon: 'google-g' },
			github: { name: 'GitHub', icon: 'github' },
			local: { name: 'Local Account', icon: 'vpdb' },
		};
		config.vpdb.passport.ipboard.forEach(ipb => {
			providerInfo[ipb.id] = pick(ipb, ['name', 'icon']) as { name: string, icon: string };
		});

		// process results
		const logs = result.docs.map(log => {

			if (providerInfo[log.payload.provider]) {
				log.payload.providerInfo = providerInfo[log.payload.provider];
			}
			return state.serializers.LogUser.detailed(ctx, log);
		});
		return this.success(ctx, logs, 200, this.paginationOpts(pagination, result.total));
	}
}
