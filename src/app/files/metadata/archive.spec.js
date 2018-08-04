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
/*global describe, before, after, it*/

const expect = require('expect.js');

const ApiClient = require('../../../test/api.client');
const FileHelper = require('../../../test/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

describe('The VPDB `file` API for archives', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator'] }
		});
	});

	after(async () => await api.teardown());

	describe('when uploading a rar file', () => {

		it('should return the file listing of the archive', async () => {
			const rar = await fileHelper.createRar('moderator');
			expect(rar.metadata).to.be.an('object');
			expect(rar.metadata.entries).to.be.an('array');
			expect(rar.metadata.entries).to.have.length(3);
			expect(rar.metadata.entries[0].bytes).to.be.a('number');
			expect(rar.metadata.entries[0].bytes_compressed).to.be.a('number');
			expect(rar.metadata.entries[0].crc).to.be.a('number');
			expect(rar.metadata.entries[0].filename).to.be.a('string');
			expect(rar.metadata.entries[0].modified_at).to.be.a('string');
		});

		it('should fail if the rar file is corrupted', async () => {
			const data = '<corrupted rar data>';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'release' })
				.withContentType('application/rar')
				.withHeader('Content-Disposition', 'attachment; filename="dmd.rar"')
				.withHeader('Content-Length', String(data.length))
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});
	});

	describe('when uploading a zip file', () => {

		it('should return the file listing of the archive', async () => {
			const zip = await fileHelper.createZip('moderator');
			expect(zip.metadata).to.be.an('object');
			expect(zip.metadata.entries).to.be.an('array');
			expect(zip.metadata.entries).to.have.length(3);
			expect(zip.metadata.entries[0].bytes).to.be.a('number');
			expect(zip.metadata.entries[0].bytes_compressed).to.be.a('number');
			expect(zip.metadata.entries[0].crc).to.be.a('number');
			expect(zip.metadata.entries[0].filename).to.be.a('string');
			expect(zip.metadata.entries[0].modified_at).to.be.a('string');
		});

		it('should fail if the zip file is corrupted', async () => {
			const data = '<corrupted zip data>';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'release' })
				.withContentType('application/zip')
				.withHeader('Content-Disposition', 'attachment; filename="dmd.zip"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});
	});

});