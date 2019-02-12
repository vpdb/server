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

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { Context } from '../common/typings/context';
import { GameDocument } from '../games/game.document';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { UserDocument } from '../users/user.document';

export class CommentApi extends Api {

	/**
	 * Creates a new comment for a release.
	 *
	 * @see POST /v1/releases/:id/comments
	 * @param {Context} ctx Koa context
	 */
	public async createForRelease(ctx: Context) {

		const release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		const game = release._game as GameDocument;
		if (game.isRestricted('release')) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		let comment = new state.models.Comment({
			_from: ctx.state.user._id,
			_ref: { release },
			message: ctx.request.body.message,
			ip: this.getIpAddress(ctx),
			created_at: new Date(),
		});
		await comment.save();

		logger.info(ctx.state, '[CommentApi.createForRelease] User <%s> commented on release "%s" (%s).', ctx.state.user.email, release.id, release.name);

		const updates: Array<() => Promise<any>> = [];
		updates.push(() => release.incrementCounter('comments'));
		updates.push(() => game.incrementCounter('comments'));
		updates.push(() => ctx.state.user.incrementCounter('comments'));
		updates.push(() => LogEventUtil.log(ctx, 'create_comment', true,
			{ comment: state.serializers.Comment.simple(ctx, comment) },
			{ game: release._game._id, release: release._id }));

		await Promise.all(updates.map(u => u()));

		comment = await state.models.Comment.findById(comment._id).populate('_from').exec();

		this.success(ctx, state.serializers.Comment.simple(ctx, comment), 201);

		// notify release creator (only if not the same user)
		if ((release._created_by as UserDocument).id !== ctx.state.user.id) {
			await mailer.releaseCommented(ctx.state, release._created_by as UserDocument, ctx.state.user, game, release, ctx.request.body.message);
		}
	}

	/**
	 * Creates a new moderation comment for a release.
	 *
	 * @see POST /v1/releases/:id/moderate/comments
	 * @param {Context} ctx Koa context
	 */
	public async createForReleaseModeration(ctx: Context) {

		const release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}

		// must be owner or author of release or moderator
		const authorIds = release.authors.map(a => a._user.toString());
		const creatorId = release._created_by._id.toString();
		const isAllowed: boolean = [creatorId, ...authorIds].includes(ctx.state.user._id.toString()) ?
			true :
			await acl.isAllowed(ctx.state.user.id, 'releases', 'moderate');

		if (!isAllowed) {
			throw new ApiError('Access denied, must be either moderator or owner or author of release.').status(403);
		}
		let comment = new state.models.Comment({
			_from: ctx.state.user._id,
			_ref: { release_moderation: release },
			message: ctx.request.body.message,
			ip: this.getIpAddress(ctx),
			created_at: new Date(),
		});
		await comment.save();

		logger.info(ctx.state, '[CommentApi.createForReleaseModeration] User <%s> commented on release moderation "%s" (%s).', ctx.state.user.email, release.id, release.name);
		comment = await state.models.Comment.findById(comment._id).populate('_from').exec();
		this.success(ctx, state.serializers.Comment.simple(ctx, comment), 201);

		// notify
		await mailer.releaseModerationCommented(ctx.state, ctx.state.user, release, ctx.request.body.message);

	}

	/**
	 * Lists comments for a release
	 *
	 * @see GET /v1/releases/:id/comments
	 * @param {Context} ctx Koa context
	 */
	public async listForRelease(ctx: Context) {

		const pagination = this.pagination(ctx, 10, 50);
		const sort = this.sortParams(ctx, { released_at: 1 }, { date: '-created_at' });
		const release = await state.models.Release.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		await release.assertRestrictedView(ctx);

		const results = await state.models.Comment.paginate({ '_ref.release': release._id }, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: ['_from'],
			sort,
		});

		const comments = results.docs.map(comment => state.serializers.Comment.simple(ctx, comment));
		return this.success(ctx, comments, 200, this.paginationOpts(pagination, results.total));
	}

	/**
	 * Lists all moderation comments for a release.
	 *
	 * @see GET /v1/releases/:id/moderate/comments
	 * @param {Context} ctx Koa context
	 */
	public async listForReleaseModeration(ctx: Context) {

		const release = await state.models.Release.findOne({ id: ctx.params.id }).exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
		}
		// check permission
		const authorIds = release.authors.map(a => a._user.toString());
		const creatorId = release._created_by.toString();
		const isAllowed: boolean = [creatorId, ...authorIds].includes(ctx.state.user._id.toString()) ?
			true :
			await acl.isAllowed(ctx.state.user.id, 'releases', 'moderate');

		if (!isAllowed) {
			throw new ApiError('Access denied, must be either moderator or owner or author of release.').status(403);
		}
		const comments = await state.models.Comment.find({ '_ref.release_moderation': release._id })
			.populate('_from')
			.sort({ created_at: 'asc' })
			.exec();

		return this.success(ctx, comments.map(comment => state.serializers.Comment.simple(ctx, comment)), 200);
	}
}
