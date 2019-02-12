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

const readFileSync = require('fs').readFileSync;
const resolve = require('path').resolve;
const gm = require('gm');
const pleasejs = require('pleasejs');

require('bluebird').promisifyAll(gm.prototype);

const rom = resolve(__dirname, '../../data/test/files/hulk.zip');
const vpt = resolve(__dirname, '../../data/test/files/empty.vpt');
const vpt2 = resolve(__dirname, '../../data/test/files/table.vpt');
const mp3 = resolve(__dirname, '../../data/test/files/test.mp3');
const mp4 = resolve(__dirname, '../../data/test/files/afm.f4v');
const avi = resolve(__dirname, '../../data/test/files/afm.avi');

class FileHelper {

	constructor(api) {
		this.api = api;
	}

	/**
	 * Uploads a playfield image.
	 *
	 * @param user Uploader
	 * @param {string} orientation
	 * @param type File type
	 * @param opts Options
	 * @param {boolean} [opts.keep=false] If true, don't teardown.
	 * @return Promise<File> Uploaded file
	 */
	async createPlayfield(user, orientation, type, opts) {
		const playfields = await this.createPlayfields(user, orientation, 1, type, opts);
		return playfields[0];
	}

	/**
	 * Uploads a logo at 600x200 pixels.
	 *
	 * @param user Uploader
	 * @param opts
	 * @returns {Promise<Object>} Uploaded file
	 */
	async createLogo(user, opts) {
		opts = opts || {};
		const fileType = 'logo';
		const mimeType = 'image/png';
		const teardown = opts.keep ? false : undefined;
		const name = 'logo.png';
		const img = gm(600, 200, pleasejs.make_color());
		const data = await img.toBufferAsync('PNG');
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: fileType })
			.withContentType(mimeType)
			.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	/**
	 * Uploads multiple playfield images.
	 *
	 * @param user Uploader
	 * @param orientation
	 * @param times Number of files to upload
	 * @param type File type
	 * @param opts Options
	 * @param {boolean} [opts.keep=false] If true, don't teardown.
	 * @return Promise<File[]> Uploaded files
	 */
	async createPlayfields(user, orientation, times, type, opts) {
		opts = opts || {};
		const fileType = type || 'playfield-' + orientation;
		const mimeType = 'image/png';
		const isFS = orientation === 'fs';
		const results = [];
		const teardown = opts.keep ? false : undefined;
		for (let i = 0; i < times; i++) {
			const name = 'playfield-' + i + '.png';
			const img = gm(isFS ? 1080 : 1920, isFS ? 1920 : 1080, pleasejs.make_color());
			const data = await img.toBufferAsync('PNG');
			const res = await this.api.onStorage()
				.as(user)
				.markTeardown(teardown)
				.withQuery({ type: fileType })
				.withContentType(mimeType)
				.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectStatus(201));
			results.push(res.data);
		}
		return results;
	}

	/**
	 * Uploads a backglass image.
	 *
	 * @param {user|string} user Uploader
	 * @param {object} [opts] Options
	 * @param {boolean} [opts.keep=false] If true, don't teardown.
	 * @return Promise<File> Uploaded file
	 */
	async createBackglass(user, opts) {
		opts = opts || {};
		const teardown = opts.keep ? false : undefined;
		const fileType = 'backglass';
		const mimeType = 'image/png';
		const name = 'backglass.png';
		const img = gm(640, 512, pleasejs.make_color());
		const data = await img.toBufferAsync('PNG');
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: fileType })
			.withContentType(mimeType)
			.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createRar(user, opts) {
		opts = opts || {};
		const file = opts.file || 'dmd.rar';
		const teardown = opts.keep ? false : undefined;
		const rar = resolve(__dirname, '../../data/test/files', file);
		const data = readFileSync(rar);
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'release' })
			.withContentType('application/rar')
			.withHeader('Content-Disposition', 'attachment; filename="' + file + '"')
			.withHeader('Content-Length', String(data.length))
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createZip(user, opts) {
		opts = opts || {};
		const file = opts.file || 'dmd.zip';
		const teardown = opts.keep ? false : undefined;
		const zip = resolve(__dirname, '../../data/test/files', file);
		const data = readFileSync(zip);
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'release' })
			.withContentType('application/zip')
			.withHeader('Content-Disposition', 'attachment; filename="' + file + '"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createRom(user, opts) {
		opts = opts || {};
		const fileName = opts.fileName || 'hulk.zip';
		const teardown = opts.keep ? false : undefined;
		const data = readFileSync(rom);
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'rom' })
			.withContentType('application/zip')
			.withHeader('Content-Disposition', 'attachment; filename="' + fileName + '"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createTextfile(user, opts) {
		opts = opts || {};
		const teardown = opts.keep ? false : undefined;
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'release' })
			.withContentType('text/plain')
			.withHeader('Content-Disposition', 'attachment; filename="README.txt"')
			.post('/v1/files', 'You are looking at a text file generated during a test.')
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createMp4(user) {
		const data = readFileSync(mp4);
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown()
			.withQuery({ type: 'playfield-fs' })
			.withContentType('video/mp4')
			.withHeader('Content-Disposition', 'attachment; filename="playfield.mp4"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createMp3(user, opts) {
		opts = opts || {};
		const data = readFileSync(mp3);
		const teardown = opts.keep ? false : undefined;
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'release' })
			.withContentType('audio/mp3')
			.withHeader('Content-Disposition', 'attachment; filename="test.mp3"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	async createAvi(user, opts) {
		opts = opts || {};
		const data = readFileSync(avi);
		const teardown = opts.keep ? false : undefined;
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'playfield-fs' })
			.withContentType('video/avi')
			.withHeader('Content-Disposition', 'attachment; filename="playfield.avi"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;
	}

	/**
	 * Uploads a VPT file.
	 *
	 * @param user Uploader
	 * @param opts Options
	 * @param {boolean} [opts.keep=false] If true, don't teardown.
	 * @return Promise<File> Uploaded file
	 */
	async createVpt(user, opts) {
		const vpts = await this.createVpts(user, 1, opts);
		return vpts[0];
	}

	/**
	 * Uploads multiple VPT files.
	 *
	 * @param user Uploader
	 * @param times Number of files to upload
	 * @param opts Options
	 * @param {boolean} [opts.keep=false] If true, don't teardown.
	 * @return Promise<File[]> Uploaded files
	 */
	async createVpts(user, times, opts) {
		opts = opts || {};
		const data = opts.alternateVpt ? readFileSync(vpt2) : readFileSync(vpt);
		const teardown = opts.keep ? false : undefined;
		const vpts = [];
		for (let n = 0; n < times; n++) {
			const res = await this.api.onStorage()
				.as(user)
				.markTeardown(teardown)
				.withQuery({ type: 'release' })
				.withContentType('application/x-visual-pinball-table')
				.withHeader('Content-Disposition', 'attachment; filename="test-table-' + n + '.vpt"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectStatus(201));
			vpts.push(res.data);
		}
		return vpts;
	}

	async createDirectB2S(user, opts) {
		opts = opts || {}
		const gameName = opts.gameName || 'aavenger';
		const teardown = opts.keep ? false : undefined;
		const image = await gm(1280, 1024, pleasejs.make_color()).toBufferAsync('PNG');
		const data = `<B2SBackglassData Version="1.2">
			  <ProjectGUID Value="41664711-BFB7-4911-ABE1-31542BFD0014" />
			  <ProjectGUID2 Value="C29873B0-D97B-4461-91CD-8897167F5CA0" />
			  <AssemblyGUID Value="BF0C830A-6FFB-449C-8770-68E2D3A9FFF3" />
			  <Name Value="VPDB Test" />
			  <VSName Value="VPDB Test.vpt" />
			  <DualBackglass Value="0" />
			  <Author Value="test" />
			  <Artwork Value="test" />
			  <GameName Value="${gameName}" />
			  <TableType Value="3" />
			  <AddEMDefaults Value="0" />
			  <DMDType Value="1" />
			  <CommType Value="1" />
			  <DestType Value="1" />
			  <NumberOfPlayers Value="4" />
			  <B2SDataCount Value="5" />
			  <ReelType Value="" />
			  <UseDream7LEDs Value="1" />
			  <D7Glow Value="0" />
			  <D7Thickness Value="0" />
			  <D7Shear Value="0" />
			  <ReelRollingDirection Value="0" />
			  <ReelRollingInterval Value="0" />
			  <ReelIntermediateImageCount Value="0" />
			  <GrillHeight Value="0" />
			  <DMDDefaultLocationX Value="0" />
			  <DMDDefaultLocationY Value="0" />
			  <Animations />
			  <Scores />
			  <Illumination />
			  <Images>
				<ThumbnailImage Value="iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACx&#xD;&#xA;jwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAvSURBVFhH7c4hAQAACAMw+tDfvhrEuJmY3+zm&#xD;&#xA;mgQEBAQEBAQEBAQEBAQEBMqB3AOdXkx5NpzLCAAAAABJRU5ErkJggg==" />
				<BackglassImage Type="0" RomID="0" RomIDType="0" FileName="backglass.png" Value="${image.toString('base64')}" />
			  </Images>
			</B2SBackglassData>`;
		const res = await this.api.onStorage()
			.as(user)
			.markTeardown(teardown)
			.withQuery({ type: 'backglass' })
			.withContentType('application/x-directb2s')
			.withHeader('Content-Disposition', 'attachment; filename="test.directb2s"')
			.withHeader('Content-Length', data.length)
			.post('/v1/files', data)
			.then(res => res.expectStatus(201));
		return res.data;

	};
}

module.exports = FileHelper;