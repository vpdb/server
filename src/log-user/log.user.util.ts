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

import { isEmpty, reduce, isEqual } from 'lodash';
import { logger } from '../common/logger';
import { slackbot } from '../common/slackbot';
import { Context } from '../common/types/context';
import { User } from '../users/user';

export class LogUserUtil {

	public static async success(ctx: Context, user: User, event: string, payload?: { [key: string]: any }, actor?: User): Promise<void> {
		await LogUserUtil.log(ctx, user, 'success', event, payload, actor, undefined);
	}

	public static async failure(ctx: Context, user: User, event: string, payload: { [key: string]: any }, actor: User, message: string): Promise<void> {
		await LogUserUtil.log(ctx, user, 'failure', event, payload, actor, message);
	}

	public static async successDiff(ctx: Context, user: User, event: string, obj1: { [key: string]: any }, obj2: { [key: string]: any }, actor?: User) {
		const diff = LogUserUtil.diff(obj1, obj2);
		if (diff && !isEmpty(diff.new)) {
			await LogUserUtil.success(ctx, user, event, diff, actor);
		}
	}

	public static diff(obj1: { [key: string]: any }, obj2: { [key: string]: any }): ObjectDiff {
		return reduce(obj1, function (result: ObjectDiff, val, key) {
			if (!isEqual(obj2[key], val)) {
				result.old[key] = val;
				result.new[key] = obj2[key];
			}
			return result;
		}, { 'old': {}, 'new': {} });
	}

	private static async log(ctx: Context, user: User, result: 'success' | 'failure', event: string, payload: { [key: string]: any }, actor: User, message: string): Promise<void> {
		actor = actor || user;
		const log = new ctx.models.LogUser({
			_user: user._id || user,
			_actor: actor,
			event: event,
			payload: payload,
			ip: ctx.ip || ctx.request.get('x-forwarded-for') || '0.0.0.0',
			result: result,
			message: message,
			logged_at: new Date()
		});
		try {
			await log.save();
			await slackbot.logUser(log);
		} catch (err) {
			logger.error('[model|loguser] Error saving log for "%s": %s', event, err.message, err);
		}
	}
}

interface ObjectDiff {
	'old': { [key: string]: any },
	'new': { [key: string]: any }
}