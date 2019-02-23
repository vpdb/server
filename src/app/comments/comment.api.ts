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

import { cloneDeep, set } from 'lodash';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { isCreator } from '../common/mongoose/util';
import { Context } from '../common/typings/context';
import { GameDocument } from '../games/game.document';
import { LogEventUtil } from '../log-event/log.event.util';
import { ReleaseDocument } from '../releases/release.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { CommentDocument } from './comment.document';

export class CommentApi extends Api {

	/**
	 * Creates a new comment for a release.
	 *
	 * @see POST /v1/releases/:id/comments
	 * @param {Context} ctx Koa context
	 */
	public async createForRelease(ctx: Context) {

		const span = this.apmStartSpan('CommentApi.createForRelease');
		let release: ReleaseDocument;
		let game: GameDocument;
		try {
			release = await state.models.Release.findOne({ id: ctx.params.id })
				.populate('_game')
				.populate('_created_by')
				.exec();

			if (!release) {
				throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
			}
			game = release._game as GameDocument;
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

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// notify release creator (only if not the same user)
			if ((release._created_by as UserDocument).id !== ctx.state.user.id) {
				await mailer.releaseCommented(ctx.state, release._created_by as UserDocument, ctx.state.user, game, release, ctx.request.body.message);
			}
		});
	}

	/**
	 * Creates a new moderation comment for a release.
	 *
	 * @see POST /v1/releases/:id/moderate/comments
	 * @param {Context} ctx Koa context
	 */
	public async createForReleaseModeration(ctx: Context) {

		const span = this.apmStartSpan('CommentApi.createForReleaseModeration');
		let comment: CommentDocument;
		let release: ReleaseDocument;
		try {
			release = await state.models.Release.findOne({ id: ctx.params.id })
				.populate('_game')
				.populate('_created_by')
				.exec();

			if (!release) {
				throw new ApiError('No such release with ID "%s"', ctx.params.id).status(404);
			}

			// must be owner or author of release or moderator
			const isModerator = await acl.isAllowed(ctx.state.user.id, 'releases', 'moderate');
			if (!isCreator(ctx, release) && !isModerator) {
				throw new ApiError('Access denied, must be either moderator or owner or author of release.').status(403);
			}

			comment = new state.models.Comment({
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

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// log
			LogEventUtil.log(ctx, 'create_moderated_comment', false,
				{ comment: state.serializers.Comment.simple(ctx, comment) },
				{ game: release._game._id, release: release._id });

			// notify
			await mailer.releaseModerationCommented(ctx.state, ctx.state.user, release, ctx.request.body.message);
		});
	}

	public async update(ctx: Context) {
		const span = this.apmStartSpan('CommentApi.update');

		let newRef: any;
		let oldComment: CommentDocument;
		try {
			const comment = await state.models.Comment.findOne({ id: ctx.params.id }).exec();
			if (!comment) {

				throw new ApiError('No such comment with ID "%s"', ctx.params.id).status(404);
			}
			const updates: Array<() => Promise<any>> = [];

			// currently only supports reference change.
			if (ctx.request.body._ref) {

				// assert that proper _ref attribute is set
				if (!ctx.request.body._ref.release && !ctx.request.body._ref.release_moderation) {
					throw new ApiError('Validation error').validationError('_ref', 'Must contain either `release` or `release_moderation`.', ctx.request.body._ref);
				}

				// assert that only one _ref attribute is set
				if (ctx.request.body._ref.release && ctx.request.body._ref.release_moderation) {
					throw new ApiError('Validation error').validationError('_ref', 'Can only contain `release` or `release_moderation`, not both.', ctx.request.body._ref);
				}

				// assert moderator permissions
				const isModerator = await acl.isAllowed(ctx.state.user.id, 'releases', 'moderate');
				if (!isModerator) {
					throw new ApiError('Access denied, must be moderator to change reference.').status(403);
				}

				// assert that the provided ref exists
				const refPath = ctx.request.body._ref.release ? '_ref.release' : '_ref.release_moderation';
				const refValue = ctx.request.body._ref.release || ctx.request.body._ref.release_moderation;
				const release = await state.models.Release.findOne({ id: refValue })
					.populate('_game')
					.populate('_created_by')
					.exec();
				if (!release) {
					throw new ApiError('Validation error').validationError(refPath, 'Unknown reference to release.', refValue);
				}
				const game = release._game as GameDocument;

				// assert that the provided ref is the same
				const currentRef = comment._ref.release || comment._ref.release_moderation;
				newRef = release._id;
				if (!currentRef._id.equals(newRef._id)) {
					throw new ApiError('Validation error').validationError(refPath, 'Cannot point reference to different release.', refValue);
				}
				oldComment = cloneDeep(comment);
				if (ctx.request.body._ref.release) {
					comment._ref.release_moderation = undefined;
					comment._ref.release = newRef.toString();
					updates.push(() => release.incrementCounter('comments'));
					updates.push(() => game.incrementCounter('comments'));
					updates.push(() => ctx.state.user.incrementCounter('comments'));
				} else {
					comment._ref.release = undefined;
					comment._ref.release_moderation = newRef.toString();
					updates.push(() => release.incrementCounter('comments', -1));
					updates.push(() => game.incrementCounter('comments', -1));
					updates.push(() => ctx.state.user.incrementCounter('comments', -1));
				}
			}

			// save
			await comment.save();
			await Promise.all(updates.map(u => u()));

			// return
			const updatedComment = await state.models.Comment.findById(comment._id)
				.populate('_from')
				.populate('_ref.release')
				.populate('_ref.release_moderation')
				.exec();
			this.success(ctx, state.serializers.Comment.detailed(ctx, updatedComment), 200);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}

		this.noAwait(async () => {

			// log
			const release = await state.models.Release.findById(newRef)
				.populate('_game')
				.populate('_created_by')
				.exec();

			// log event
			await LogEventUtil.log(ctx, 'update_comment', false,
				LogEventUtil.diff(state.serializers.Comment.simple(ctx, oldComment), ctx.request.body),
				{ game: release._game._id, release: release._id },
			);
		});
	}

	/**
	 * Lists comments for a release
	 *
	 * @see GET /v1/releases/:id/comments
	 * @param {Context} ctx Koa context
	 */
	public async listForRelease(ctx: Context) {

		const span = this.apmStartSpan('CommentApi.listForRelease');
		try {
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
			this.success(ctx, comments, 200, this.paginationOpts(pagination, results.total));

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}

	/**
	 * Lists all moderation comments for a release.
	 *
	 * @see GET /v1/releases/:id/moderate/comments
	 * @param {Context} ctx Koa context
	 */
	public async listForReleaseModeration(ctx: Context) {

		const span = this.apmStartSpan('CommentApi.listForReleaseModeration');
		try {
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

			this.success(ctx, comments.map(comment => state.serializers.Comment.simple(ctx, comment)), 200);

		} catch (err) {
			throw err;

		} finally {
			this.apmEndSpan(span);
		}
	}
}
