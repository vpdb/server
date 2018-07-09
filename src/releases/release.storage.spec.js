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

'use strict';
/* global describe, before, after, it */

const expect = require('expect.js');
const yauzl = require('yauzl');

const ApiClient = require('../../test/modules/api.client');

const api = new ApiClient();

let res;
describe('The VPDB `Release` storage API', () => {

	let release, backglass, mp3, rom, pfVideo, txt, logo, game, gameName;
	describe('when downloading a release', () => {

		before(async () => {
			await api.setupUsers({
				countertest: { roles: ['member'] },
				moderator: { roles: ['moderator'] },
				contributor: { roles: ['contributor'] },
				creator: { roles: ['moderator', 'contributor'] },
			});

			// create a full game
			logo = await api.fileHelper.createLogo('creator', { keep: true });
			game = await api.gameHelper.createGame('creator', { _logo: logo.id });
			gameName = game.title;
			if (game.year && game.manufacturer) {
				gameName += ' (' + game.manufacturer + ' ' + game.year + ')';
			}

			// create a backglass
			backglass = await api.releaseHelper.createDirectB2S('creator', { game: game });

			// create rom
			rom = await api.gameHelper.createRom('creator', game.id);

			// create full release
			pfVideo = await api.fileHelper.createAvi('creator', { keep: true });
			mp3 = await api.fileHelper.createMp3('creator', { keep: true });
			txt = await api.fileHelper.createTextfile('creator', { keep: true });

			release = await api.releaseHelper.createReleaseForGame('creator', game, {
				release: {
					description: 'Release description',
					acknowledgements: 'CREDITS file'
				},
				file: { _playfield_video: pfVideo.id },
				files: [{ _file: mp3.id }, { _file: txt.id }]
			});
			res = await api.get('/v1/games/' + game.id).then(res => res.expectStatus(200));
			game = res.data;
		});

		after(async () => await api.teardown());

		it('should correctly download everything', async () => {

			const body = {
				files: [release.versions[0].files[0].file.id],
				media: {
					playfield_image: true,
					playfield_video: true
				},
				game_media: game.media.map(m => m.id),
				backglass: backglass.id,
				roms: [rom.id]
			};

			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: JSON.stringify(body) }))
				.withHeader('Accept', 'application/zip')
				.responseAs('arraybuffer')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectStatus(200));

			const entries = await new Promise((resolve, reject) => {
				const e = new Map();
				yauzl.fromBuffer(res.data, (err, zipfile) => {
					if (err) {
						return reject(err);
					}
					zipfile.on('entry', entry => e.set(entry.fileName, entry.uncompressedSize));
					zipfile.on('end', () => resolve(e));
					zipfile.on('error', reject);
				});
			});

			const tableFile = release.versions[0].files.find(vf => vf.file.mime_type.includes('visual-pinball-table'));

			expect(entries.get(`Visual Pinball/Tables/${gameName}.vpt`)).to.be(tableFile.file.bytes);
			expect(entries.get(`Visual Pinball/Tables/${txt.name}`)).to.be(txt.bytes);
			expect(entries.get(`Visual Pinball/Music/${mp3.name}`)).to.be(mp3.bytes);
			expect(entries.get(`Visual Pinball/VPinMAME/roms/${rom.name}`)).to.be(rom.bytes);
			expect(entries.get(`Visual Pinball/Tables/${gameName}.directb2s`)).to.be.ok();
			expect(entries.get(`PinballX/Media/Visual Pinball/Wheel Images/${gameName}.png`)).to.be.ok();
			expect(entries.get(`PinballX/Media/Visual Pinball/Table Images/${gameName}.png`)).to.be.ok();
			expect(entries.get(`PinballX/Media/Visual Pinball/Table Videos/${gameName}.avi`)).to.be.ok();
			expect(entries.get(`README.txt`)).to.be.ok();
			expect(entries.get(`CREDITS.txt`)).to.be.ok();
		});

		it('should update all the necessary download counters.', async () => {

			const release = await api.releaseHelper.createRelease('contributor');
			const url = '/storage/v1/releases/' + release.id;
			const body = {
				files: [release.versions[0].files[0].file.id],
				media: {
					playfield_image: false,
					playfield_video: false
				},
				game_media: false
			};
			const token = await api.retrieveStorageToken('countertest', url);
			await api
				.withQuery(({ token: token, body: JSON.stringify(body) }))
				.getAbsolute(url)
				.then(res => res.expectStatus(200));

			// game downloads
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);

			// release / file downloads
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);
			expect(res.data.versions[0].counter.downloads).to.be(1);
			expect(res.data.versions[0].files[0].counter.downloads).to.be(1);
			expect(res.data.versions[0].files[0].file.counter.downloads).to.be(1);

			// check user counter
			res = await api.as('countertest').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.counter.downloads).to.be(1);
		});
	});

});