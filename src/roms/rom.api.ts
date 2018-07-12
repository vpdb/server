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

import Zip from 'adm-zip'; // todo migrate to unzip
import { assign, extend, pick } from 'lodash';

import { Schema, Types } from 'mongoose';
import { acl } from '../common/acl';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { Context } from '../common/typings/context';
import { Game } from '../games/game';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { Rom } from './rom';

export class RomApi extends Api {

	/**
	 * Creates a new ROM.
	 *
	 * @see POST /v1/games/:gameId/roms
	 * @see POST /v1/roms
	 * @param {Context} ctx Koa context
	 */
	public async create(ctx: Context) {
		const validFields = ['id', 'version', 'notes', 'languages', '_file'];

		if (!ctx.params.gameId && !ctx.request.body._ipdb_number) {
			throw new ApiError('You must provide an IPDB number when not posting to a game resource.').status(422);
		}

		// validate here because we use it in the query before running rom validations
		if (ctx.request.body._ipdb_number) {
			if (ctx.params.gameId) {
				throw new ApiError().validationError('_ipdb_number', 'You must not provide an IPDB number when posting to a game resource', ctx.request.body._ipdb_number);
			}
			if (!Number.isInteger(ctx.request.body._ipdb_number) || ctx.request.body._ipdb_number < 0) {
				throw new ApiError().validationError('_ipdb_number', 'Must be a positive integer', ctx.request.body._ipdb_number);
			}
		}

		const q = ctx.params.gameId ? { id: ctx.params.gameId } : { 'ipdb.number': ctx.request.body._ipdb_number };
		let game = await state.models.Game.findOne(q).exec();

		const rom = extend(pick(ctx.request.body, validFields), {
			_created_by: ctx.state.user._id,
			created_at: new Date(),
		}) as Rom;

		let gameRef: Game;
		if (game) {
			rom._game = game._id;
			rom._ipdb_number = game.ipdb.number;
			gameRef = state.serializers.Game.reduced(ctx, game);

		} else {
			if (ctx.params.gameId) {
				throw new ApiError('No such game with ID "%s"', ctx.params.gameId).status(404);
			}
			game = { ipdb: { number: ctx.request.body._ipdb_number } } as Game;
			rom._ipdb_number = ctx.request.body._ipdb_number;
			gameRef = game;
		}
		let newRom = await state.models.Rom.getInstance(rom);
		await newRom.validate();

		const file = await state.models.File.findById(newRom._file).exec();
		try {
			newRom.rom_files = [];
			const zip = new Zip(file.getPath());
			zip.getEntries().forEach(zipEntry => {
				if (zipEntry.isDirectory) {
					return;
				}
				newRom.rom_files.push({
					filename: zipEntry.name,
					bytes: (zipEntry.header as any).size,
					crc: (zipEntry.header as any).crc,
					modified_at: new Date((zipEntry.header as any).time),
				});
			});

		} catch (err) {
			throw new ApiError('Invalid zip archive: %s', err.message).log(err).status(422);
		}
		newRom = await newRom.save();
		logger.info('[RomApi.create] Rom "%s" successfully added.', newRom.id);
		await newRom.activateFiles();

		await LogEventUtil.log(ctx, 'upload_rom', true, {
			rom: state.serializers.Rom.simple(ctx, newRom),
			game: gameRef,
		}, { game: game._id });

		return this.success(ctx, state.serializers.Rom.simple(ctx, newRom), 201);
	}

	/**
	 * Lists all ROMs for a given game.
	 *
	 * @see GET /v1/roms
	 * @see GET /v1/games/:gameId/roms
	 * @param {Context} ctx Koa context
	 */
	public async list(ctx: Context) {

		const pagination = this.pagination(ctx, 10, 50);
		let game: Game;
		let ipdbNumber: number;

		// list roms of a game below /api/v1/games/{gameId}
		if (ctx.params.gameId) {
			game = await state.models.Game.findOne({ id: ctx.params.gameId }).exec();

		} else if (ctx.query.game_id) {
			game = await state.models.Game.findOne({ id: ctx.query.game_id }).exec();

		} else if (ctx.query.ipdb_number) {
			ipdbNumber = parseInt(ctx.query.ipdb_number, 10);
			if (!ipdbNumber) {
				throw new ApiError('Validation error').validationError('ipdb_number', 'Must be a whole number', ctx.query.ipdb_number);
			}
			game = await state.models.Game.findOne({ 'ipdb.number': ipdbNumber }).exec();
		}

		let query: any;
		if (game) {
			query = await state.models.Rom.applyRestrictionsForGame(ctx, game, { _game: game._id });
		} else {
			// no game found.
			if (ctx.params.gameId) {
				throw new ApiError('No such game with ID "%s".', ctx.params.gameId).status(404);
			}
			if (ctx.query.game_id) {
				throw new ApiError('No such game with ID "%s".', ctx.query.game_id).status(404);
			}
			if (ipdbNumber) {
				query = { _ipdb_number: ipdbNumber };
			} else {
				query = await state.models.Rom.applyRestrictions(ctx, {});
			}
		}

		let results: Rom[];
		let count: number;
		if (!query) {
			results = [];
			count = 0;
		} else {
			const sort = game ? { version: -1 } : { '_file.name': 1 };
			const r = await state.models.Rom.paginate(query, {
				page: pagination.page,
				limit: pagination.perPage,
				populate: ['_file', '_created_by'],
				sort,
			});
			results = r.docs;
			count = r.total;
		}

		const roms = results.map(rom => state.serializers.Rom.simple(ctx, rom));
		return this.success(ctx, roms, 200, this.paginationOpts(pagination, count));
	}

	/**
	 * Returns details of a ROM
	 *
	 * @see GET /v1/roms/:id
	 * @param {Context} ctx Koa context
	 */
	public async view(ctx: Context) {

		const rom = await state.models.Rom.findOne({ id: ctx.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

		if (!rom) {
			throw new ApiError('No such ROM with ID "%s".', ctx.params.id).status(404);
		}
		return this.success(ctx, rom._game ?
			assign(state.serializers.Rom.simple(ctx, rom), { game: state.serializers.Game.simple(ctx, rom._game as Game) }) :
			state.serializers.Rom.simple(ctx, rom));
	}

	/**
	 * Deletes a ROM.
	 *
	 * FIXME: check delete-own permissions
	 * @see DELETE /v1/roms/:id
	 * @param {Context} ctx Koa context
	 */
	public async del(ctx: Context) {

		const canDelete = await acl.isAllowed(ctx.state.user.id, 'roms', 'delete');
		const rom = await state.models.Rom.findOne({ id: ctx.params.id }).exec();

		if (!rom) {
			throw new ApiError('No such ROM with ID "%s".', ctx.params.id).status(404);
		}

		// only allow deleting own roms
		if (!canDelete && !(rom._created_by as Types.ObjectId).equals(ctx.state.user._id)) {
			throw new ApiError('Permission denied, must be owner.').status(403);
		}

		// remove from db
		await rom.remove();
		logger.info('[RomApi.del] ROM "%s" successfully deleted.', rom.id);
		return this.success(ctx, null, 204);
	}
}
