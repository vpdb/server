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
import { Document, Model } from 'mongoose';
import { logger } from './logger';

/**
 * An API end point (or, more RESTful, a "resource") bundles all the
 * functionality implemented by each end point, notably:
 *
 *    - API routes
 *    - API controller
 *    - Database model
 *    - Entity type
 */
export abstract class EndPoint {

	/**
	 * The name (plural) of the end point.
	 */
	public abstract readonly name: string;

	/**
	 * Returns the router containing all the routes of the end point.
	 * @return {Router}
	 */
	public abstract getRouter(): Router;

	public registerModel(): EndPoint {
		return this;
	}

	public registerSerializer(): EndPoint {
		return this;
	}

	public async import(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Bulk-imports data.
	 *
	 * @param {Model<Document>} model Model to use
	 * @param {any[]} data Data to import
	 */
	protected async importData(model: Model<Document>, data: any[]) {
		const count = await model.count({});
		/* istanbul ignore if: Database is always empty before running tests. */
		if (count) {
			logger.info(null, '[EndPoint.importData] Skipping data population for model "%s", collection is not empty.', model.modelName);
			return;
		}
		logger.info(null, '[EndPoint.importData] Inserting %d rows into collection "%s"..', data.length, model.modelName);
		await model.collection.insertMany(data);
	}
}
