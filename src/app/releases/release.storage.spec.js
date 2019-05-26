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

'use strict';
/* global describe, before, after, it */

const expect = require('expect.js');
const yauzl = require('yauzl');

const ApiClient = require('../../test/api.client');

const api = new ApiClient();

let res;
describe('The VPDB `Release` storage API', () => {

	let release, backglass, mp3, rom, pfVideo, txt, logo, game, gameName;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
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
		const folderZip = await api.fileHelper.createZip('creator', { file: 'release.asset.folder.zip', keep: true });
		const rootZip = await api.fileHelper.createZip('creator', { file: 'release.asset.root.zip', keep: true });
		const folderRar = await api.fileHelper.createRar('creator', { file: 'release.asset.folder.rar', keep: true });
		const rootRar = await api.fileHelper.createRar('creator', { file: 'release.asset.root.rar', keep: true });

		release = await api.releaseHelper.createReleaseForGame('creator', game, {
			release: {
				description: 'Release description',
				acknowledgements: 'CREDITS file'
			},
			file: { _playfield_video: pfVideo.id },
			files: [
				{ _file: mp3.id },
				{ _file: txt.id },
				{ _file: folderZip.id },
				{ _file: rootZip.id },
				{ _file: folderRar.id },
				{ _file: rootRar.id },
			]
		});
		res = await api.get('/v1/games/' + game.id).then(res => res.expectStatus(200));
		game = res.data;
	});

	after(async () => await api.teardown());

	describe('when downloading a release', () => {

		it('should fail when invalid JSON is provided as body', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: '{ "test"' }))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(400, 'Error parsing JSON'));
		});

		it('should fail when no files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: JSON.stringify({ files: [] })}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'need to provide which files'));
		});

		it('should fail for invalid release', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: JSON.stringify({ files: [ 'duh' ] })}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/foobar')
				.then(res => res.expectError(404, 'No such release'));
		});

		it('should fail when invalid release files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: JSON.stringify({ files: [ 'suckah' ] })}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'did not match any release file'));
		});

		it('should fail when invalid media files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({
					body: JSON.stringify({
						files: [release.versions[0].files[0].file.id],
						game_media: ['foobar']
					})
				}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'is not part of the game\'s media'));
		});

		it('should fail when invalid ROM files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({
					body: JSON.stringify({
						files: [release.versions[0].files[0].file.id],
						roms: ['foobar']
					})
				}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'Could not find ROM'));
		});

		it('should fail when invalid backglass files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({
					body: JSON.stringify({
						files: [release.versions[0].files[0].file.id],
						backglass: ['foobar']
					})
				}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'Could not find backglass'));
		});

		it('should fail when unrelated backglass files are provided', async () => {
			const bg = await api.releaseHelper.createDirectB2S('creator');
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({
					body: JSON.stringify({
						files: [release.versions[0].files[0].file.id],
						backglass: [bg.id]
					})
				}))
				.withHeader('Accept', 'application/zip')
				.get('/v1/releases/' + release.id)
				.then(res => res.expectError(422, 'is not the same game as'));
		});

		it('should fail validation when no files are provided', async () => {
			res = await api
				.onStorage()
				.as('creator')
				.withQuery(({ body: JSON.stringify({ files: [] })}))
				.withHeader('Accept', 'application/zip')
				.head('/v1/releases/' + release.id)
				.then(res => res.expectStatus(204).expectHeader('x-error', 'You need to provide which files you want to include in the download.'));
		});

		it('should correctly validate the download', async () => {

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
				.head('/v1/releases/' + release.id)
				.then(res => res.expectStatus(204));
		});


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
				.responseAsBuffer()
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
			expect(entries.get(`PinballX/Media/Visual Pinball/Wheel Images/${gameName}.png`)).to.be.greaterThan(100);
			expect(entries.get(`PinballX/Media/Visual Pinball/Table Images/${gameName}.png`)).to.be.greaterThan(100);
			expect(entries.get(`PinballX/Media/Visual Pinball/Table Videos/${gameName}.avi`)).to.be.greaterThan(1000);
			expect(entries.get(`Visual Pinball/Tables/release.asset.root/tablepic.from.zip.png`)).to.be.greaterThan(1000);
			expect(entries.get(`Visual Pinball/Tables/release.asset.root/tablepic.from.rar.png`)).to.be.greaterThan(1000);
			expect(entries.get(`Visual Pinball/Tables/subfolder-zip/tablepic.from.zip.png`)).to.be.greaterThan(1000);
			expect(entries.get(`Visual Pinball/Tables/subfolder-rar/tablepic.from.rar.png`)).to.be.greaterThan(1000);
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

	describe('when downloading a release file', () => {

		it('should update the counters of the release version', async () => {
			const r = await api.releaseHelper.createRelease('moderator', { version: '1.0'});
			await api.as('member').get(r.versions[0].files[0].file.url).then(res => res.expectStatus(200));
			res = await api.get(`/v1/releases/${r.id}`).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.versions[0].counter.downloads).to.be(1);
			expect(res.data.counter.downloads).to.be(1);
		});
	});

	describe('when requesting a thumb redirection', () => {

		it('should fail for a non-existent release', async () => {
			await api
				.onStorage()
				.get('/v1/releases/foobar/thumb')
				.then(res => res.expectError(404, 'No such release'));
		});

		it('should succeed for valid release', async () => {
			res = await api
				.onStorage()
				.withQuery({ format: 'playfield-fs' })
				.get('/v1/releases/' + release.id + '/thumb')
				.then(res => res.expectStatus(302));
			expect(res.headers['location']).to.contain('/storage/public/files/medium/');
		});

	});
});
