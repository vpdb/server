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

import { isEmpty, isEqual, reduce } from 'lodash';

import { logger } from '../common/logger';
import { slackbot } from '../common/slackbot';
import { Context } from '../common/typings/context';
import { state } from '../state';
import { UserDocument } from '../users/user.document';

export class LogUserUtil {

	public static async success(ctx: Context, user: UserDocument, event: string, payload?: { [key: string]: any }, actor?: UserDocument): Promise<void> {
		await LogUserUtil.log(ctx, user, 'success', event, payload, actor, undefined);
	}

	public static async failure(ctx: Context, user: UserDocument, event: string, payload: { [key: string]: any }, actor: UserDocument, message: string): Promise<void> {
		await LogUserUtil.log(ctx, user, 'failure', event, payload, actor, message);
	}

	public static async successDiff(ctx: Context, user: UserDocument, event: string, obj1: { [key: string]: any }, obj2: { [key: string]: any }, actor?: UserDocument) {
		const diff = LogUserUtil.diff(obj1, obj2);
		if (diff && !isEmpty(diff.new)) {
			await LogUserUtil.success(ctx, user, event, diff, actor);
		}
	}

	public static diff(obj1: { [key: string]: any }, obj2: { [key: string]: any }): ObjectDiff {
		return reduce(obj1, (result: ObjectDiff, val, key) => {
			if (!isEqual(obj2[key], val)) {
				result.old[key] = val;
				result.new[key] = obj2[key];
			}
			return result;
		}, { old: {}, new: {} });
	}

	private static async log(ctx: Context, user: UserDocument, result: 'success' | 'failure', event: string, payload: { [key: string]: any }, actor: UserDocument, message: string): Promise<void> {
		actor = actor || user;
		const log = new state.models.LogUser({
			_user: user._id || user,
			_actor: actor,
			event,
			payload,
			ip: ctx.ip || ctx.request.get('x-forwarded-for') || '0.0.0.0',
			result,
			message,
			logged_at: new Date(),
		});
		try {
			await log.save();
			await slackbot.logUser(log);
		} catch (err) {
			logger.error(ctx.state, '[LogUserUtil] Error saving log for "%s": %s', event, err.message, err);
		}
	}
}

interface ObjectDiff {
	'old': { [key: string]: any };
	'new': { [key: string]: any };
}
