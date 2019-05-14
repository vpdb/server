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

import mongoose from 'mongoose';
import { endPoints } from '../app/common/api.endpoints';
import { logger } from '../app/common/logger';
import { config } from '../app/common/settings';
import { state } from '../app/state';
import { slackbot } from '../app/common/slackbot';

const slackEnabled = false;

(async () => {

	try {

		const now = Date.now();
		logger.info(null, 'Checking database for coherence...');
		await bootstrapDatabase();
		const warnings = await checkDatabase();

		if (warnings.length > 0) {
			logger.info(null, 'Done in %sms, there were %s inconsistencies.', Date.now() - now, warnings.length);
		} else {
			logger.info(null, 'Done in %sms, everything looks fine!', Date.now() - now);
		}

		process.exit(0);

	} catch (err) {
		console.error(err);
		process.exit(1);

	} finally {
		await closeDatabase();
	}

})();

async function checkDatabase(ignoreLogEvents = true): Promise<string[]> {

	const messages: string[] = [];
	let i = 0;

	// backglasses
	const backglasses = await state.models.Backglass.find({}).exec();
	for (const backglass of backglasses) {
		messages.push(...assert('Backglass', backglass._id, '_created_by', backglass._created_by, await state.models.User.findById(backglass._created_by).exec()));
		messages.push(...assert('Backglass', backglass._id, '_game', backglass._game, await state.models.Game.findById(backglass._game).exec()));
		for (const author of backglass.authors) {
			messages.push(...assert('Backglass', backglass._id, `authors.${i}._user`, author._user, await state.models.User.findById(author._user).exec()));
			i++;
		}
		i = 0;
		for (const version of backglass.versions) {
			messages.push(...assert('Backglass', backglass._id, `versions.${i}._file`, version._file, await state.models.File.findById(version._file).exec()));
			i++;
		}
		if (backglass.moderation && backglass.moderation.history) {
			i = 0;
			for (const item of backglass.moderation.history) {
				messages.push(...assert('Backglass', backglass._id, `moderation.history.${i}._created_by`, item._created_by, await state.models.User.findById(item._created_by).exec()));
				i++;
			}
		}
	}

	// builds
	const builds = await state.models.Build.find({}).exec();
	for (const build of builds) {
		messages.push(...assertOptional('Build', build._id, '_created_by', build._created_by, await state.models.User.findById(build._created_by).exec()));
	}

	// comments
	const comments = await state.models.Comment.find({}).exec();
	for (const comment of comments) {
		messages.push(...assert('Comment', comment._id, `_from`, comment._from, await state.models.User.findById(comment._from).exec()));
		messages.push(...assertOptional('Comment', comment._id, `_ref.release`, comment._ref.release, await state.models.Release.findById(comment._ref.release).exec()));
		messages.push(...assertOptional('Comment', comment._id, `_ref.release_moderation`, comment._ref.release_moderation, await state.models.Release.findById(comment._ref.release_moderation).exec()));
		messages.push(...assertOne('Comment', comment._id, [
			{ refField: `_ref.release`, refId: comment._ref.release },
			{ refField: `_ref.release_moderation`, refId: comment._ref.release_moderation },
		]));
	}

	// files
	const files = await state.models.File.find({}).exec();
	for (const file of files) {
		messages.push(...assert('File', file._id, '_created_by', file._created_by, await state.models.User.findById(file._created_by).exec()));
	}

	// game request
	const gameRequests = await state.models.GameRequest.find({}).exec();
	for (const gr of gameRequests) {
		messages.push(...assert('GameRequest', gr._id, '_game', gr._game, await state.models.Game.findById(gr._game).exec()));
		messages.push(...assert('GameRequest', gr._id, '_created_by', gr._created_by, await state.models.User.findById(gr._created_by).exec()));
	}

	// games
	const games = await state.models.Game.find({}).exec();
	for (const game of games) {
		messages.push(...assert('Game', game._id, '_backglass', game._backglass, await state.models.File.findById(game._backglass).exec()));
		messages.push(...assertOptional('Game', game._id, '_logo', game._logo, await state.models.File.findById(game._logo).exec()));
		messages.push(...assert('Game', game._id, '_created_by', game._created_by, await state.models.User.findById(game._created_by).exec()));
	}

	// log events
	if (!ignoreLogEvents) {
		const logEvents = await state.models.LogEvent.find({}).exec();
		for (const logEvent of logEvents) {
			messages.push(...assert('LogEvent', logEvent._id, '_actor', logEvent._actor, await state.models.User.findById(logEvent._actor).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.game`, logEvent._ref.game, await state.models.Game.findById(logEvent._ref.game).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.release`, logEvent._ref.release, await state.models.Release.findById(logEvent._ref.release).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.backglass`, logEvent._ref.backglass, await state.models.Backglass.findById(logEvent._ref.backglass).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.user`, logEvent._ref.user, await state.models.User.findById(logEvent._ref.user).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.game_request`, logEvent._ref.game_request, await state.models.GameRequest.findById(logEvent._ref.game_request).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.build`, logEvent._ref.build, await state.models.Build.findById(logEvent._ref.build).exec()));
			messages.push(...assertOptional('LogEvent', logEvent._id, `_ref.file`, logEvent._ref.file, await state.models.File.findById(logEvent._ref.file).exec()));
			const ipdbRef = logEvent.payload && logEvent.payload.game ? logEvent.payload.game.ipdb : undefined;
			messages.push(...assertOneOrMore('LogEvent', logEvent._id, [
				{ refField: `payload.game.ipdb`, refId: ipdbRef },
				{ refField: `_ref.game`, refId: logEvent._ref.game },
				{ refField: `_ref.release`, refId: logEvent._ref.release },
				{ refField: `_ref.backglass`, refId: logEvent._ref.backglass },
				{ refField: `_ref.user`, refId: logEvent._ref.user },
				{ refField: `_ref.game_request`, refId: logEvent._ref.game_request },
				{ refField: `_ref.build`, refId: logEvent._ref.build },
				{ refField: `_ref.file`, refId: logEvent._ref.file },
			]));
		}
	}

	// log user
	const logUser = await state.models.LogUser.find({}).exec();
	for (const log of logUser) {
		messages.push(...assert('LogEvent', log._id, '_actor', log._actor, await state.models.User.findById(log._actor).exec()));
		messages.push(...assert('LogEvent', log._id, '_user', log._user, await state.models.User.findById(log._user).exec()));
	}

	// media
	const media = await state.models.Medium.find({}).exec();
	for (const medium of media) {
		messages.push(...assert('Medium', medium._id, `_file`, medium._file, await state.models.File.findById(medium._file).exec()));
		messages.push(...assertOptional('Medium', medium._id, `_ref.game`, medium._ref.game, await state.models.Game.findById(medium._ref.game).exec()));
		messages.push(...assertOptional('Medium', medium._id, `_ref.release`, medium._ref.release, await state.models.Release.findById(medium._ref.release).exec()));
		messages.push(...assertOne('Comment', medium._id, [
			{ refField: `_ref.game`, refId: medium._ref.game },
			{ refField: `_ref.release`, refId: medium._ref.release },
		]));
	}

	// ratings
	const ratings = await state.models.Rating.find({}).exec();
	for (const rating of ratings) {
		messages.push(...assert('Rating', rating._id, '_from', rating._from, await state.models.User.findById(rating._from).exec()));
		messages.push(...assertOptional('Rating', rating._id, '_ref.game', rating._ref.game, await state.models.Game.findById(rating._ref.game).exec()));
		messages.push(...assertOptional('Rating', rating._id, '_ref.release', rating._ref.release, await state.models.Release.findById(rating._ref.release).exec()));
		messages.push(...assertOne('Rating', rating._id, [
			{ refField: `_ref.game`, refId: rating._ref.game },
			{ refField: `_ref.release`, refId: rating._ref.release },
		]));
	}

	// releases
	const releases = await state.models.Release.find({}).exec();
	for (const release of releases) {
		messages.push(...assert('Release', release._id, '_game', release._game, await state.models.Game.findById(release._game).exec()));
		messages.push(...assert('Release', release._id, '_created_by', release._created_by, await state.models.User.findById(release._created_by).exec()));
		if (release.original_version) {
			messages.push(...assert('Release', release._id, 'original_version._ref', release.original_version._ref, await state.models.Release.findById(release.original_version._ref).exec()));
		}
		i = 0;
		for (const tag of release._tags) {
			messages.push(...assert('Release', release._id, `_tags.${i}`, tag, await state.models.Tag.findById(tag).exec()));
			i++;
		}
		i = 0;
		for (const author of release.authors) {
			messages.push(...assert('Release', release._id, `authors.${i}._user`, author._user, await state.models.User.findById(author._user).exec()));
			i++;
		}
		i = 0;
		for (const version of release.versions) {
			let j = 0;
			for (const versionFile of version.files) {
				messages.push(...assert('Release', release._id, `versions.${i}.files.${j}._file`, versionFile._file, await state.models.File.findById(versionFile._file).exec()));
				if (!versionFile.flavor) {
					messages.push(...assert('Release', release._id, `versions.${i}.files.${j}._playfield_image`, versionFile._playfield_image, await state.models.File.findById(versionFile._playfield_image).exec()));
					messages.push(...assertOptional('Release', release._id, `versions.${i}.files.${j}._playfield_video`, versionFile._playfield_video, await state.models.File.findById(versionFile._playfield_video).exec()));
					let k = 0;
					for (const build of versionFile._compatibility) {
						messages.push(...assert('Release', release._id, `versions.${i}.files.${j}._compatibility.${k}`, build, await state.models.Build.findById(build).exec()));
						k++;
					}
					if (versionFile.validation) {
						messages.push(...assertOptional('Release', release._id, `versions.${i}.files.${j}.validation._validated_by`, versionFile.validation._validated_by, await state.models.User.findById(versionFile.validation._validated_by).exec()));
					}
				}
				j++;
			}
			i++;
		}
		if (release.moderation && release.moderation.history) {
			i = 0;
			for (const item of release.moderation.history) {
				messages.push(...assert('Release', release._id, `moderation.history.${i}._created_by`, item._created_by, await state.models.User.findById(item._created_by).exec()));
				i++;
			}
		}
	}

	// roms
	const roms = await state.models.Rom.find({}).exec();
	for (const rom of roms) {
		messages.push(...assert('Roms', rom._id, '_file', rom._file, await state.models.File.findById(rom._file).exec()));
		messages.push(...assert('Roms', rom._id, '_created_by', rom._created_by, await state.models.User.findById(rom._created_by).exec()));
		messages.push(...assertOptional('Roms', rom._id, '_game', rom._game, await state.models.Game.findById(rom._game).exec()));
		messages.push(...assertOneOrMore('Roms', rom._id, [
			{ refField: `_ref.game`, refId: rom._game },
			{ refField: `_ipdb_number`, refId: rom._ipdb_number },
		]));
	}

	// stars
	const stars = await state.models.Star.find({}).exec();
	for (const star of stars) {
		messages.push(...assert('Star', star._id, '_from', star._from, await state.models.User.findById(star._from).exec()));
		messages.push(...assertOptional('Star', star._id, '_ref.game', star._ref.game, await state.models.Game.findById(star._ref.game).exec()));
		messages.push(...assertOptional('Star', star._id, '_ref.release', star._ref.release, await state.models.Release.findById(star._ref.release).exec()));
		messages.push(...assertOptional('Star', star._id, '_ref.user', star._ref.user, await state.models.User.findById(star._ref.user).exec()));
		messages.push(...assertOptional('Star', star._id, '_ref.medium', star._ref.medium, await state.models.Medium.findById(star._ref.medium).exec()));
		messages.push(...assertOptional('Star', star._id, '_ref.backglass', star._ref.backglass, await state.models.Backglass.findById(star._ref.backglass).exec()));
		messages.push(...assertOne('Star', star._id, [
			{ refField: `_ref.game`, refId: star._ref.game },
			{ refField: `_ref.release`, refId: star._ref.release },
			{ refField: `_ref.user`, refId: star._ref.user },
			{ refField: `_ref.medium`, refId: star._ref.medium },
			{ refField: `_ref.backglass`, refId: star._ref.backglass },
		]));
	}

	// table blocks
	const tableBlocks = await state.models.TableBlock.find({}).exec();
	for (const tableBlock of tableBlocks) {
		i = 0;
		for (const file of tableBlock._files) {
			messages.push(...assert('TableBlock', tableBlock._id, `_files.${i}`, file, await state.models.File.findById(file).exec()));
			i++;
		}
	}

	// tags
	const tags = await state.models.Tag.find({}).exec();
	for (const tag of tags) {
		messages.push(...assertOptional('Tag', tag._id, '_created_by', tag._created_by, await state.models.User.findById(tag._created_by).exec()));
	}

	// tokens
	const tokens = await state.models.Token.find({}).exec();
	for (const token of tokens) {
		messages.push(...assert('Token', token._id, '_created_by', token._created_by, await state.models.User.findById(token._created_by).exec()));
	}

	return messages;
}

function assertOptional(parentModel: string, parentId: any, refField: string, refId: any, refResult: any): string[] {
	return assert(parentModel, parentId, refField, refId, refResult, true);
}

function assert(parentModel: string, parentId: any, refField: string, refId: any, refResult: any, optional = false): string[] {
	if (!optional && !refId) {
		const message = `*[${parentModel}]* Document \`${parentId.toString()}\` is missing required field \`${refField}\`.`;
		log(message);
		return [message];

	} else if (refId && !refResult) {
		const message = `*[${parentModel}]* Document \`${parentId.toString()}\` is missing reference \`${refId.toString()}\` of field \`${refField}\`.`;
		log(message);
		return [message]
	}
	return [];
}

function assertOneOrMore(parentModel: string, parentId: any, fields: { refField: string, refId: any }[], message = 'one or more references'): string[] {
	const populatedFields = fields.filter(f => !!f.refId);
	if (populatedFields.length === 0) {
		const warn = `*[${parentModel}]* Document \`${parentId.toString()}\` must have ${message} within [ \`${fields.map(f => f.refField).join('`, `')}\` ] but none found.`;
		log(warn);
		return [warn];
	}
	return [];
}

function assertOne(parentModel: string, parentId: any, fields: { refField: string, refId: any }[]) {
	const populatedFields = fields.filter(f => !!f.refId);
	const warn = assertOneOrMore(parentModel, parentId, fields, 'exactly one reference');
	if (warn.length === 0 && populatedFields.length > 1) {
		const message = `*[${parentModel}]* Document \`${parentId.toString()}\` must have exactly one reference, but multiple found: [ \`${populatedFields.map(f => f.refField).join('`, `')}\` ]`;
		log(message);
		warn.push(message);
	}
	return warn;
}

function log(message: string) {
	//this.config.channels.infra
	logger.warn(null, message);
	if (slackEnabled) {
		// noinspection JSIgnoredPromiseFromCall
		slackbot.rawMessage(config.vpdb.logging.slack.channels.infra, 'DB Checker', message);
	}
}

async function bootstrapDatabase() {
	await mongoose.connect(config.vpdb.db, { useNewUrlParser: true });
	for (const endPoint of endPoints) {
		endPoint.registerModel();
	}
}

async function closeDatabase() {
	await mongoose.connection.close();
}
