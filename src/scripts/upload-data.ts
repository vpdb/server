/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

import yargs, { Arguments, Argv, PositionalOptions } from 'yargs';

import { GameUploader } from './upload/game.uploader';
import { ReleaseUploader } from './upload/release.uploader';
import { RomUploader } from './upload/rom.uploader';

/* tslint:disable:no-unused-expression */
(async () => {

	try {
		const envOpts: PositionalOptions = {
			type: 'string',
			default: 'local',
			describe: 'The name of the environment',
			choices: ['local', 'test', 'staging', 'production'],
		};
		yargs
			.usage('$0 <cmd> <environment>')
			.command('games <env>', 'Upload all games',
				(args: Argv) => args.positional('env', envOpts),
				async (args: Arguments) => {
					const uploader = new GameUploader(args.env);
					await uploader.upload();
					console.log('All games added!');
				})
			.command('releases <env>', 'Upload all releases',
				(args: Argv) => args.positional('env', envOpts),
				async (args: Arguments) => {
					const uploader = new ReleaseUploader(args.env);
					await uploader.upload();
					console.log('All releases added!');
				})
			.command('roms <env>', 'Upload all ROMs',
				(args: Argv) => args.positional('env', envOpts),
				async (args: Arguments) => {
					const uploader = new RomUploader(args.env);
					await uploader.upload();
					console.log('All ROMs added!');
				})
			.help().argv;

	} catch (err) {
		console.error(err);
	}
})();
