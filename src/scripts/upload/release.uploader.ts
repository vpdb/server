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

import { createReadStream, existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import { get, set } from 'lodash';
import { extname, resolve } from 'path';
import { inspect } from 'util';

import { FileDocument } from '../../app/files/file.document';
import { mimeTypes } from '../../app/files/file.mimetypes';
import { DataUploader } from './data.uploader';

export class ReleaseUploader extends DataUploader {

	public async upload(): Promise<void> {
		await this.login();
		const rootPath = resolve(this.config.folder, 'releases');
		for (const gameId of readdirSync(rootPath)) {
			const gamePath = resolve(rootPath, gameId);
			if (!lstatSync(gamePath).isDirectory()) {
				continue;
			}

			for (const releaseName of readdirSync(gamePath)) {

				const releasePath = resolve(rootPath, gameId, releaseName);
				if (!lstatSync(releasePath).isDirectory()) {
					continue;
				}

				// read index.json
				let releaseData: string;
				const releaseJsonPath = resolve(releasePath, 'index.json');
				if (existsSync(releaseJsonPath)) {
					releaseData = readFileSync(releaseJsonPath).toString();
				} else {
					console.error('Missing index.json at ' + releasePath + ', skipping.');
					continue;
				}

				const releaseJson = await this.parseJson(releaseData, releasePath);
				releaseJson._game = gameId;
				releaseJson.name = releaseName;
				releaseJson.versions = [];
				releaseJson.authors = [{ _user: this.getUploader().id, roles: ['Uploader'] }];

				for (const version of readdirSync(releasePath)) {
					const versionPath = resolve(rootPath, gameId, releaseName, version);
					if (!lstatSync(versionPath).isDirectory()) {
						continue;
					}

					// read index.json
					let versionData: string;
					const versionJsonPath = resolve(versionPath, 'index.json');
					if (existsSync(versionJsonPath)) {
						versionData = readFileSync(versionJsonPath).toString();
					} else {
						console.error('Missing index.json at ' + versionJsonPath + ', skipping.');
						continue;
					}

					const versionJson = await this.parseJson(versionData, versionPath);
					versionJson.version = version;
					releaseJson.versions.push(versionJson);
				}

				// post
				console.log(inspect(releaseJson, { depth: null, colors: true }));
				const res = await this.api().post('/v1/releases', releaseJson);
				console.log('Release "%s" for game "%s" successfully uploaded.', releaseName, gameId);

				this.updateToken(res.headers['x-token-refresh']);
			}
		}
	}

	private async parseJson(data: string, pwd: string): Promise<any> {

		data = this.replaceReferences(data, pwd);

		// deserialize
		const json = JSON.parse(data);

		// if there are no files, we're done.
		if (!json.files) {
			return json;
		}

		const files = this.getFiles(json);
		this.validate(files, pwd);

		// upload referenced files
		for (const file of files) {
			const uploadedFile = await this.uploadFile(file, pwd);
			set(json, file.path, uploadedFile.id);
		}
		return json;
	}

	private validate(files: any[], path: string) {
		// some minimal validations...
		for (const file of files) {
			if (!this.getMimeType(file.filename)) {
				throw new Error('Unknown MIME type of "' + file.filename + '".');
			}
			const refPath = resolve(path, file.filename);
			if (!existsSync(refPath)) {
				throw new Error('Cannot find reference of "' + file.path + '" to ' + refPath + '.');
			}
		}
	}
	private replaceReferences(data: string, path: string) {
		// replace references with file content
		return data.replace(/"([^"]+)"\s*:\s*"!([^!][^"]+)"/g, (match, attr, filename) => {
			const refPath = resolve(path, filename);
			if (!existsSync(refPath)) {
				throw new Error('Cannot find reference of "' + attr + '" to ' + refPath + '.');
			}
			const j = JSON.stringify({[attr]: readFileSync(refPath).toString()});
			return j.substr(1, j.length - 2);
		});
	}

	private getFiles(json: any) {
		const files = [];
		let i = 0;
		for (const file of json.files) {
			if (get(file, '_file')) {
				files.push({
					path: 'files[' + i + ']._file',
					filename: get(file, '_file'),
					filetype: 'release',
				});
			}
			if (get(file, '_playfield_image')) {
				files.push({
					path: 'files[' + i + ']._playfield_image',
					filename: get(file, '_playfield_image'),
					filetype: 'playfield-' + get(file, 'flavor.orientation'),
				});
			}
			if (get(file, '_playfield_video')) {
				files.push({
					path: 'files[' + i + ']._playfield_video',
					filename: get(file, '_playfield_video'),
					filetype: 'playfield-' + get(file, 'flavor.orientation'),
				});
			}
			i++;
		}
		return files;
	}

	private async uploadFile(file: any, path: string): Promise<FileDocument> {
		const readStream = createReadStream(resolve(path, file.filename));
		console.log('Posting %s (%s) as %s...', file.filename, this.getMimeType(file.filename), file.filetype);
		const res = await this.storage().post('/v1/files', readStream, {
			params: { type: file.filetype },
			headers: {
				'Content-Disposition': 'attachment; filename="' + file.filename + '"',
				'Content-Type': this.getMimeType(file.filename),
			},
		});
		return res.data;
	}

	private getMimeType(filename: string) {
		const ext = extname(filename).substr(1).toLowerCase();
		for (const mimeType of Object.keys(mimeTypes)) {
			if (mimeTypes[mimeType].ext === ext) {
				return mimeType;
			}
		}
	}
}
