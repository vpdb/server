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

import Router from 'koa-router';
import mongoose from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { state } from '../state';
import { logEventApiRouter } from './log.event.api.router';
import { LogEventDocument } from './log.event.document';
import { logEventSchema } from './log.event.schema';
import { LogEventSerializer } from './log.event.serializer';

export class LogEventEndPoint extends EndPoint {

	public readonly name: string = 'Event Log API';

	public getRouter(): Router {
		return logEventApiRouter;
	}

	public registerModel(): EndPoint {
		state.models.LogEvent = mongoose.model<LogEventDocument>('LogEvent', logEventSchema);
		return this;
	}

	public registerSerializer(): EndPoint {
		state.serializers.LogEvent = new LogEventSerializer();
		return this;
	}
}
