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
import { createReadStream, existsSync } from 'fs';
import { isEmpty } from 'lodash';
import { resolve } from 'path';

import { RomDocument } from '../../app/roms/rom.document';
import { DataUploader } from './data.uploader';

export class RomUploader extends DataUploader {

	public async upload(): Promise<void> {

		const roms: RomData[] = require('./roms.json');
		const games: Map<number, { ipdb: number, roms: RomData[] }> = new Map();
		roms.forEach(rom => {
			if (!games.has(rom.ipdb)) {
				games.set(rom.ipdb, { ipdb: rom.ipdb, roms: [] });
			}
			games.get(rom.ipdb).roms.push(rom);
		});
		console.log('Loaded %s ROMs for %s games.', roms.length, games.size);

		await this.login();

		const skippedRoms = [];
		const uploadedRoms = [];
		const missingRoms = [];

		for (const game of games.values()) {

			// retrieve existing ROMs for game
			console.log('Retrieving ROMs for IPDB number "%d"', game.ipdb);
			let res = await this.api().get('/v1/roms?per_page=100&ipdb_number=' + game.ipdb);

			const existingRoms = [];
			if (!isEmpty(res.data)) {
				existingRoms.push(...res.data.map((r: RomDocument) => r.id + '.zip'));
				console.log('   *** Existing ROMs: %j', existingRoms);
			}

			// for each rom
			for (const rom of game.roms) {
				const filename = rom.id + '.zip';
				if (existingRoms.includes(filename)) {
					skippedRoms.push(filename);
					continue;
				}
				const localPath = resolve(this.config.romFolder, filename);
				if (!existsSync(localPath)) {
					missingRoms.push(filename);
					continue;
				}

				const romContentStream = createReadStream(localPath);
				console.log('   --- Uploading %s...', localPath);

				// upload file
				res = await this.storage().post('/v1/files?type=rom', romContentStream, {
					headers: {
						'Content-Type': 'application/zip',
						'Content-Disposition': 'attachment; filename="' + filename + '"',
					},
				});

				// post rom data
				const uploadedFile = res.data;
				res = await this.api().post('/v1/roms', {
					_file: uploadedFile.id,
					_ipdb_number: game.ipdb,
					id: rom.id,
					version: rom.version,
					notes: rom.notes,
					languages: rom.languages,
				});

				const uploadedRom = res.data;
				console.log('   --- Uploaded ROM with ID "%s" created!', uploadedRom.id);
				uploadedRoms.push(filename);

				this.updateToken(res.headers['x-token-refresh']);
			}
		}

		// log
		if (!isEmpty(skippedRoms)) {
			console.log('   *** Skipped ROMs: %j', skippedRoms.sort());
		}
		if (!isEmpty(uploadedRoms)) {
			console.log('   *** Uploaded ROMs: %j', uploadedRoms.sort());
		}
		if (!isEmpty(missingRoms)) {
			console.log('   *** Missing ROMs: %j', missingRoms.sort());
		}
	}
}

export interface RomData {
	id: string;
	name: string;
	year: number;
	manufacturer: string;
	reference: string;
	source: string;
	notes?: string;
	languages?: string;
	ipdb: number;
	version: number;
}
