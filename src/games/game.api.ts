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

import { createReadStream } from 'fs';
import {
	assign,
	cloneDeep,
	difference,
	intersection,
	isEmpty,
	keys,
	omit,
	pick,
	sum,
	upperFirst,
	values,
} from 'lodash';
import { inspect } from 'util';

import { acl } from '../common/acl';
import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { mailer } from '../common/mailer';
import { SerializerOptions } from '../common/serializer';
import { config } from '../common/settings';
import { Context, RequestState } from '../common/typings/context';
import { FileDocument } from '../files/file.document';
import { FileUtil } from '../files/file.util';
import { GameRequestDocument } from '../game-requests/game.request.document';
import { LogEventUtil } from '../log-event/log.event.util';
import { ReleaseDocument } from '../releases/release.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { GameDocument } from './game.document';

const generate = require('project-name-generator');

export class GameApi extends Api {

	/**
	 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
	 *
	 * @see HEAD /v1/games/:id
	 * @param {Context} ctx Koa context
	 */
	public async head(ctx: Context) {
		const game = await state.models.Game.findOne({ id: ctx.params.id }).exec();
		ctx.response.set('Content-Length', '0');
		return this.success(ctx, null, game ? 200 : 404);
	}

	/**
	 * Creates a new game.
	 *
	 * @see POST /v1/games
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {

		const game = await state.models.Game.getInstance(ctx.state, assign(ctx.request.body, {
			_created_by: ctx.state.user._id,
			created_at: new Date(),
		})) as GameDocument;

		logger.info(ctx.state, '[GameApi.create] %s', inspect(ctx.request.body));
		await game.validate();

		logger.info(ctx.state, '[GameApi.create] Validations passed.');
		await game.save();

		logger.info(ctx.state, '[GameApi.create] Game "%s" created.', game.title);
		await game.activateFiles();

		// invalidate cache
		await apiCache.invalidateGame(ctx.state, game);

		logger.info(ctx.state, '[GameApi.create] Files activated.');

		// link roms if available
		if (game.ipdb && game.ipdb.number) {
			const roms = await state.models.Rom.find({ _ipdb_number: game.ipdb.number }).exec();
			logger.info(ctx.state, '[GameApi.create] Linking %d ROMs to created game %s.', roms.length, game._id);
			for (const rom of roms) {
				rom._game = game._id.toString();
				await rom.save();
			}
		}

		// find game request
		let gameRequest: GameRequestDocument;
		if (ctx.request.body._game_request) {
			gameRequest = await state.models.GameRequest
				.findOne({ id: ctx.request.body._game_request })
				.populate('_created_by')
				.exec();

		} else if (game.ipdb && game.ipdb.number) {
			gameRequest = await state.models.GameRequest
				.findOne({ ipdb_number: parseInt(String(game.ipdb.number), 10) })
				.populate('_created_by')
				.exec();
		}
		if (gameRequest) {
			await mailer.gameRequestProcessed(ctx.state, gameRequest._created_by as UserDocument, game);
			gameRequest.is_closed = true;
			gameRequest._game = game._id;
			await gameRequest.save();

			await LogEventUtil.log(ctx, 'update_game_request', false, {
				game_request: pick(state.serializers.GameRequest.simple(ctx, gameRequest), ['id', 'title', 'ipdb_number', 'ipdb_title']),
				game: state.serializers.Game.reduced(ctx, game),
			}, {
				game: game._id,
				game_request: gameRequest._id,
			});
		}

		// copy backglass and logo to media
		try {
			await Promise.all([
				this.copyMedia(ctx.state, ctx.state.user, game, game._backglass as FileDocument, 'backglass_image', bg => bg.metadata.size.width * bg.metadata.size.height > 647000),  // > 900x720
				this.copyMedia(ctx.state, ctx.state.user, game, game._logo as FileDocument, 'wheel_image'),
			]);
		} catch (err) {
			logger.error(ctx.state, '[api|game:create] Error while copying media: %s', err.message);
			logger.error(ctx.state, err);
		}
		await LogEventUtil.log(ctx, 'create_game', true, { game: omit(state.serializers.Game.simple(ctx, game), ['rating', 'counter']) }, { game: game._id });
		return this.success(ctx, state.serializers.Game.detailed(ctx, game), 201);
	}

	/**
	 * Updates an existing game.
	 *
	 * @see PATCH /v1/games/:id
	 * @param {Context} ctx Koa context
	 */
	public async update(ctx: Context) {

		const updatableFields = ['title', 'year', 'manufacturer', 'game_type', 'short', 'description', 'instructions',
			'produced_units', 'model_number', 'themes', 'designers', 'artists', 'features', 'notes', 'toys', 'slogans',
			'ipdb', 'number', '_backglass', '_logo', 'keywords'];

		const body = cloneDeep(ctx.request.body);
		let game = await state.models.Game.findOne({ id: ctx.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

		if (!game) {
			throw new ApiError('No such game with ID "%s".', ctx.params.id).status(404);
		}
		const oldGame = cloneDeep(game) as GameDocument;

		// fail if invalid fields provided
		const submittedFields = keys(ctx.request.body);
		if (intersection(updatableFields, submittedFields).length !== submittedFields.length) {
			const invalidFields = difference(submittedFields, updatableFields);
			throw new ApiError('Invalid field%s: ["%s"]. Allowed fields: ["%s"]', invalidFields.length === 1 ? '' : 's', invalidFields.join('", "'), updatableFields.join('", "')).status(400).log();
		}

		const oldMediaBackglassObj = game._backglass as FileDocument;
		const oldMediaLogoObj = game._logo as FileDocument;
		const oldMediaBackglass = (game._backglass as FileDocument).id;
		const oldMediaLogo = game._logo ? (game._logo as FileDocument).id : null;
		const newMediaBackglass = ctx.request.body._backglass || oldMediaBackglass;
		const newMediaLogo = ctx.request.body._logo || oldMediaLogo;

		// copy media if not submitted so it doesn't get erased
		ctx.request.body._backglass = newMediaBackglass;
		ctx.request.body._logo = newMediaLogo;

		// apply changes
		game = await game.updateInstance(ctx.state, ctx.request.body) as GameDocument;

		// validate and save
		await game.save();

		logger.info(ctx.state, '[GameApi.update] Game "%s" updated.', game.title);
		const activatedFileIds = await game.activateFiles();

		logger.info(ctx.state, '[GameApi.update] Activated %s new file%s.', activatedFileIds.length, activatedFileIds.length === 1 ? '' : 's');

		// invalidate cache
		await apiCache.invalidateGame(ctx.state, game);

		// copy to media and delete old media if changed
		try {
			if (oldMediaBackglass !== newMediaBackglass) {
				await this.copyMedia(ctx.state, ctx.state.user, game, game._backglass as FileDocument, 'backglass_image', bg => bg.metadata.size.width * bg.metadata.size.height > 647000);  // > 900x720
				await oldMediaBackglassObj.remove();
			}
			if (oldMediaLogo !== newMediaLogo) {
				await this.copyMedia(ctx.state, ctx.state.user, game, game._logo as FileDocument, 'wheel_image');
				if (oldMediaLogoObj) {
					await oldMediaLogoObj.remove();
				}
			}
		} catch (err) {
			logger.error(ctx.state, '[api|game:update] Error while copying and cleaning media: %s', err.message);
			logger.error(ctx.state, err);
		}
		await LogEventUtil.log(ctx, 'update_game', false, LogEventUtil.diff(oldGame, body), { game: game._id });
		return this.success(ctx, state.serializers.Game.detailed(ctx, game), 200);
	}

	/**
	 * Deletes a game.
	 *
	 * @see DELETE /v1/games/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const game = await state.models.Game.findOne({ id: ctx.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

		if (!game) {
			throw new ApiError('No such game with ID "%s".', ctx.params.id).status(404);
		}

		// check for release and backglass reference and fail if there are
		const refs: { [key: string]: number } = {
			releases: await state.models.Release.find({ _game: game._id }).count().exec(),
			backglasses: await state.models.Backglass.find({ _game: game._id }).count().exec(),
		};
		if (sum(values(refs)) > 0) {
			throw new ApiError('Cannot delete game because it is referenced by %s.', Object.keys(refs).map(f => `${refs[f]} ${f}`).join(' and '))
				.status(400).warn();
		}
		await game.remove();

		logger.info(ctx.state, '[GameApi.del] Game "%s" (%s) successfully deleted.', game.title, game.id);

		// log event
		await LogEventUtil.log(ctx, 'delete_game', false, { game: omit(state.serializers.Game.simple(ctx, game), ['rating', 'counter']) }, { game: game._id });

		return this.success(ctx, null, 204);
	}

	/**
	 * Lists all games.
	 *
	 * @see GET /v1/games
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		const pagination = this.pagination(ctx, 12, 60);
		const query: any[] = [];

		// text search
		if (ctx.query.q) {
			if (ctx.query.q.trim().length < 2) {
				throw new ApiError('Query must contain at least two characters.').status(400);
			}
			// sanitize and build regex
			const titleQuery = ctx.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
			const titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			const idQuery = ctx.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			query.push({ $or: [{ title: titleRegex }, { id: idQuery }] });
		}

		// filter by manufacturer
		if (ctx.query.mfg) {
			const mfgs = ctx.query.mfg.split(',');
			query.push({ manufacturer: mfgs.length === 1 ? mfgs[0] : { $in: mfgs } });
		}

		// filter by decade
		if (ctx.query.decade) {
			const decades: number[] = ctx.query.decade.split(',').map((str: string) => {
				const num = parseInt(str, 10);
				if (isNaN(num)) {
					throw new ApiError('Parameter "decade" must be an integer but got "%s".', str).status(400);
				}
				return num;
			});
			const d: any[] = [];
			decades.forEach(decade => {
				d.push({ year: { $gte: decade, $lt: decade + 10 } });
			});
			if (d.length === 1) {
				query.push(d[0]);
			} else {
				query.push({ $or: d });
			}
		}

		/*
		 * If min_releases is set, only list where's actually content (by content we mean "releases"):
		 *   - if logged as moderator, just query counter.releases
		 *   - if not logged, retrieve restricted game IDs and exclude them
		 *   - if member, retrieve restricted game IDs, retrieve authored/created game IDs and exclude difference
		 *
		 * Note that this a quick fix and doesn't work for min_releases > 1, though this use case isn't very useful.
		 */
		const minReleases = parseInt(ctx.query.min_releases, 10);
		if (minReleases) {

			// counter includes restricted releases
			query.push({ 'counter.releases': { $gte: minReleases } });

			// check if additional conditions are needed
			const isModerator = ctx.state.user ? (await acl.isAllowed(ctx.state.user.id, 'releases', 'view-restricted')) : false;

			// moderator gets unfiltered list
			if (!isModerator) {

				// user gets owned/authored releases
				if (ctx.state.user) {
					const releases = await state.models.Release.find({ $or: [{ _created_by: ctx.state.user._id }, { 'authors._user': ctx.state.user._id }] }).exec();
					query.push({
						$or: [
							{ 'ipdb.mpu': { $nin: config.vpdb.restrictions.release.denyMpu } },
							{ _id: { $in: releases.map(r => r._game) } },
						],
					});
				} else {
					// just exclude all restricted games for anon
					query.push({ 'ipdb.mpu': { $nin: config.vpdb.restrictions.release.denyMpu } });
				}
			}
		}

		const sort = this.sortParams(ctx, { title: 1 }, {
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			title: 'title_sortable',
		});

		const q = this.searchQuery(query);
		logger.info(ctx.state, '[GameApi.list] query: %s, sort: %j', inspect(q, { depth: null }), inspect(sort));

		const result = await state.models.Game.paginate(q, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: ['_backglass', '_logo'],
			sort,
		});
		const games = result.docs.map(game => state.serializers.Game.simple(ctx, game));
		return this.success(ctx, games, 200, this.paginationOpts(pagination, result.total));
	}

	/**
	 * Lists a game of a given game ID.
	 *
	 * @see GET /v1/games/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		// retrieve game
		const game = await state.models.Game.findOne({ id: ctx.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

		if (!game) {
			throw new ApiError('No such game with ID "%s"', ctx.params.id).status(404);
		}
		const result = state.serializers.Game.detailed(ctx, game);
		await game.incrementCounter('views');

		// retrieve linked releases
		const opts: SerializerOptions = {};
		const rlsQuery = await state.models.Release.applyRestrictionsForGame(ctx, game, { _game: game._id });
		if (rlsQuery) {
			// retrieve stars if logged
			if (ctx.state.user) {
				const stars = await state.models.Star.find({
					type: 'release',
					_from: ctx.state.user._id,
				}).exec();
				opts.starredReleaseIds = stars.map(star => star._ref.release.toString());
			}
			const releases = await state.models.Release.find(state.models.Release.approvedQuery(rlsQuery))
				.populate({ path: '_tags' })
				.populate({ path: '_created_by' })
				.populate({ path: 'authors._user' })
				.populate({ path: 'versions.files._file' })
				.populate({ path: 'versions.files._playfield_image' })
				.populate({ path: 'versions.files._playfield_video' })
				.populate({ path: 'versions.files._compatibility' })
				.lean()
				.exec() as ReleaseDocument[];
			opts.excludedFields = ['game'];
			result.releases = releases.map(release => state.serializers.Release.detailed(ctx, release, opts));

		} else {
			result.releases = [];
		}

		// retrieve linked backglasses
		const backglassQuery = await state.models.Backglass.applyRestrictionsForGame(ctx, game, { _game: game._id });
		if (backglassQuery) {
			const backglasses = await state.models.Backglass.find(state.models.Backglass.approvedQuery(backglassQuery))
				.populate({ path: 'authors._user' })
				.populate({ path: 'versions._file' })
				.populate({ path: '_created_by' })
				.exec();
			result.backglasses = backglasses.map(backglass => state.serializers.Backglass.simple(ctx, backglass, { excludedFields: ['game'] }));

		} else {
			result.backglasses = [];
		}

		const media = await state.models.Medium.find({ '_ref.game': game._id })
			.populate({ path: '_file' })
			.populate({ path: '_created_by' })
			.exec();

		result.media = media.map(medium => state.serializers.Medium.simple(ctx, medium), { excludedFields: ['game'] });

		return this.success(ctx, result, 200);
	}

	/**
	 * Returns a random name for release name inspiration
	 *
	 * @see GET /v1/games/:id/release-name
	 * @param {Context} ctx Koa context
	 */
	public async releaseName(ctx: Context) {

		const game = await state.models.Game.findOne({ id: ctx.params.id }).exec();

		if (!game) {
			throw new ApiError('No such game with ID "%s".', ctx.params.id).status(404);
		}
		const words: string[] = generate().raw;
		if (!isEmpty(game.keywords)) {
			words.splice(words.length - 1);
			words.push(game.keywords[Math.floor(Math.random() * game.keywords.length)]);
		}
		words.push('edition');
		return this.success(ctx, { name: words.map(w => w.toLowerCase()).map(upperFirst).join(' ') }, 200);
	}

	/**
	 * Copies a given file to a given media type.
	 *
	 * @param requestState For logging
	 * @param {UserDocument} user Creator of the media
	 * @param {GameDocument} game Game the media will be linked to
	 * @param {FileDocument} file File to be copied
	 * @param {string} category Media category
	 * @param {function} [check] Function called with file parameter. Media gets discarded if false is returned.
	 */
	private async copyMedia(requestState: RequestState, user: UserDocument, game: GameDocument, file: FileDocument, category: string, check?: (file: FileDocument) => boolean): Promise<string[]> {

		check = check || (() => true);
		if (file && check(file)) {

			const fieldsToCopy = ['name', 'bytes', 'created_at', 'mime_type', 'file_type'];
			const fileToCopy = assign(pick(file, fieldsToCopy), {
				_created_by: user,
				variations: {},
			}) as FileDocument;
			const copiedFile = await FileUtil.create(requestState, fileToCopy, createReadStream(file.getPath(requestState)));
			logger.info(requestState, '[GameApi.copyMedia] Copied file "%s" to "%s".', file.id, copiedFile.id);
			let medium = new state.models.Medium({
				_file: copiedFile._id,
				_ref: { game: game._id },
				category,
				created_at: new Date(),
				_created_by: user,
			});
			medium = await medium.save();
			logger.info(requestState, '[GameApi.copyMedia] Copied %s as media to %s.', category, medium.id);
			return medium.activateFiles();
		}
	}
}
