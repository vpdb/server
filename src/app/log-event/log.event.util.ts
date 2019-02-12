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

import { isEqual, isObject, keys, pick, reduce } from 'lodash';

import { slackbot } from '../common/slackbot';
import { Context } from '../common/typings/context';
import { state } from '../state';

export class LogEventUtil {

	public static async log(ctx: Context, event: string, isPublic: boolean, payload: any, ref: any) {
		const actor = ctx.state.user ? ctx.state.user._id : null;
		let log = new state.models.LogEvent({
			_actor: actor,
			_ref: ref,
			event,
			payload,
			is_public: isPublic,
			ip: ctx.request.get('x-forwarded-for') || ctx.ip || '0.0.0.0',
			logged_at: new Date(),
		});
		log = await log.save();
		await slackbot.logEvent(log);
	}

	public static diff(fromDB: { [key: string]: any }, fromAPI: { [key: string]: any }) {

		fromDB = pick(fromDB, keys(fromAPI));
		return reduce(fromDB, (result: { old: { [key: string]: any }, new: { [key: string]: any } }, val, key) => {
			if (!isEqual(fromAPI[key], val)) {
				if (isObject(val)) {
					const d = LogEventUtil.diff(val, fromAPI[key]);
					result.old[key] = d.old;
					result.new[key] = d.new;
				} else {
					result.old[key] = val;
					result.new[key] = fromAPI[key];
				}
			}
			return result;
		}, { old: {}, new: {} });
	}
}
