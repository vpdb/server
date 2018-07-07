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

import Application = require('koa');
import Router from 'koa-router';
import mongoose, { Schema } from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { state } from '../state';
import { LogEvent } from './log.event';
import { router } from './log.event.api.router';
import { logEventSchema } from './log.event.schema';
import { LogEventSerializer } from './log.event.serializer';

export class LogEventEndPoint extends EndPoint {

	public readonly name: string = 'Event Log API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		super();
		this._router = router;
		this._schema = logEventSchema;
	}

	public getRouter(): Router {
		return this._router;
	}

	public async register(app: Application): Promise<void> {
		state.models.LogEvent = mongoose.model<LogEvent>('LogEvent', this._schema);
		state.serializers.LogEvent = new LogEventSerializer();
	}
}
