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

import { assign, cloneDeep, pick } from 'lodash';
import { Schema } from 'mongoose';

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { LogEventUtil } from '../log-event/log.event.util';
import { acl } from '../common/acl';

export class BuildApi extends Api {

	/**
	 * Lists all current builds.
	 *
	 * @see GET /v1/builds
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		let query: any;
		if (ctx.state.user) {
			// logged users also get their own builds even if inactive.
			query = { $or: [{ is_active: true }, { _created_by: ctx.state.user._id }] };
		} else {
			query = { is_active: true };
		}

		let builds = await state.models.Build.find(query).exec();

		// reduce
		builds = builds.map(build => state.serializers.Build.simple(ctx, build));
		return this.success(ctx, builds);
	}

	/**
	 * Updates an existing build.
	 *
	 * @see PATCH /v1/builds/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['id', 'platform', 'major_version', 'label', 'download_url', 'support_url', 'built_at',
			'description', 'type', 'is_range', 'is_active'];

		const build = await state.models.Build.findOne({ id: ctx.params.id }).exec();

		// build must exist
		if (!build) {
			throw new ApiError('No such build with ID "%s".', ctx.params.id).status(404);
		}

		const oldBuild = cloneDeep(state.serializers.Build.detailed(ctx, build));

		// check fields and assign to object
		this.assertFields(ctx, updatableFields);
		assign(build, pick(ctx.request.body, updatableFields));


		// those fields are empty if data comes from initialization, so populate them.
		if (!build.created_at) {
			build.created_at = new Date();
		}
		if (!build._created_by) {
			build._created_by = ctx.state.user._id.toString();
		}

		await build.save();
		const newBuild = await state.models.Build.findById(build._id).populate('_created_by').exec();

		logger.info('[BuildApi.create] Build "%s" successfully updated.', newBuild.id);
		this.success(ctx, state.serializers.Build.detailed(ctx, newBuild), 200);

		// log event
		await LogEventUtil.log(ctx, 'update_build', false, LogEventUtil.diff(oldBuild, ctx.request.body), { build: newBuild._id });
	}

	/**
	 * View details of a given build.
	 *
	 * @see GET /v1/builds/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		const build = await state.models.Build.findOne({ id: ctx.params.id }).exec();

		// build must exist
		if (!build) {
			throw new ApiError('No such build with ID "%s".', ctx.params.id).status(404);
		}
		return this.success(ctx, state.serializers.Build.detailed(ctx, build), 200);
	}

	/**
	 * Creates a new build.
	 *
	 * @see POST /v1/builds
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const newBuild = new state.models.Build(ctx.request.body);
		const idFromLabel = newBuild.label ? newBuild.label.replace(/(^[^a-z0-9._-]+)|([^a-z0-9._-]+$)/gi, '').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase() : '-';
		newBuild.id = newBuild.id || idFromLabel;
		newBuild.is_active = false;
		newBuild.created_at = new Date();
		newBuild._created_by = ctx.state.user._id;
		await newBuild.save();

		logger.info('[BuildApi.create] Build "%s" successfully created.', newBuild.label);
		this.success(ctx, state.serializers.Build.simple(ctx, newBuild), 201);

		// log event
		await LogEventUtil.log(ctx, 'create_build', false, state.serializers.Build.detailed(ctx, newBuild), { build: newBuild._id });
	}

	/**
	 * Deletes a build.
	 *
	 * @see DELETE /v1/builds/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const build = await state.models.Build.findOne({ id: ctx.params.id }).exec();

		// build must exist
		if (!build) {
			throw new ApiError('No such build with ID "%s".', ctx.params.id).status(404);
		}

		// only allow deleting own builds
		const canGloballyDeleteBuilds = await acl.isAllowed(ctx.state.user.id, 'builds', 'delete');
		if (!canGloballyDeleteBuilds && (!build._created_by || !(build._created_by as Schema.Types.ObjectId).equals(ctx.state.user._id))) {
			throw new ApiError('Permission denied, must be owner.').status(403).log();
		}

		const releases = await state.models.Release.find({ 'versions.files._compatibility': build._id }).exec();

		if (releases.length !== 0) {
			throw new ApiError('Cannot delete referenced build. The following releases must be unlinked first: ["%s"].', releases.map(r => r.id).join('", "')).status(400);
		}
		await build.remove();

		logger.info('[BuildApi.delete] Build "%s" (%s) successfully deleted.', build.label, build.id);
		this.success(ctx, null, 204);

		// log event
		await LogEventUtil.log(ctx, 'delete_build', false, state.serializers.Build.simple(ctx, build), { build: build._id });
	}
}
