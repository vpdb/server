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
import { extname, basename } from 'path';
import { isUndefined, isArray, intersection, sortBy } from 'lodash';
import unzip from 'unzip';
import archiver, { Archiver } from 'archiver';

import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { User, UserPreferences } from '../users/user';
import { Release } from './release';
import { logger } from '../common/logger';
import { File } from '../files/file';
import { flavors } from './release.flavors';
import { Game } from '../games/game';
import { ReleaseVersion } from './release.version';
import { ReleaseVersionFile } from './release.version.file';
import { ApiError } from '../common/api.error';
import { quota } from '../common/quota';
import { state } from '../state';
import { Schema } from 'mongoose';
import { fileTypes } from '../files/file.types';

const Unrar = require('unrar');

export class ReleaseStorage extends Api {

	/**
	 * Downloads a release.
	 *
	 * You provide the release to download as well as the table file IDs for the
	 * release.
	 *
	 * Example:
	 *
	 *    GET https://vpdb.io/storage/v1/releases/XkviQgQ6m?body={}&token=123
	 *
	 * where body is something like (url-encoded):
	 *
	 *  {
	 *  	"files": [ "XJejOk7p7" ],
	 *  	"media": {
	 *  		"playfield_image": true,
	 *  		"playfield_video": false
	 *  	},
	 *  	"game_media": [ "dfdDg35Sf", "gfppdDbNas" ],
	 *  	"backglass": "hffDDsh34",
	 *  	"roms": [ "afm_113b", "afm_113" ]
	 *  }
	 *
	 * @param {Context} ctx Koa context
	 */
	public async download(ctx: Context) {

		const [release, requestedFiles] = await this.collectFiles(ctx, false);
		const game = release._game as Game;

		// create zip stream
		const archive = archiver('zip');

		let gameName = game.title;
		if (game.year && game.manufacturer) {
			gameName += ' (' + game.manufacturer + ' ' + game.year + ')';
		}

		ctx.status = 200;
		ctx.set('Content-Type', 'application/zip');
		ctx.set('Content-Disposition', 'attachment; filename="' + gameName + '.zip"'); // todo add release name and authors to zip filename
		archive.pipe(ctx.res);

		// add tables to stream
		let releaseFiles: string[] = [];
		for (const file of requestedFiles) {
			let name = '';
			let path = '';
			let filename;
			switch (file.file_type) {
				case 'logo':
					name = 'PinballX/Media/Visual Pinball/Wheel Images/' + gameName + file.getExt();
					break;

				case 'backglass':
					if (file.getMimeCategory() === 'image') {
						name = 'PinballX/Media/Visual Pinball/Backglass Images/' + gameName + file.getExt();
					}
					if (file.getMimeCategory() === 'directb2s') {
						name = 'Visual Pinball/Tables/' + gameName + file.getExt();
					}
					break;

				case 'playfield-fs':
				case 'playfield-ws':
					if (file.getMimeCategory() === 'image') {
						name = 'PinballX/Media/Visual Pinball/Table Images/' + gameName + file.getExt();
						path = file.getPath(file.getVariation('hyperpin'));
					}
					if (file.getMimeCategory() === 'video') {
						name = 'PinballX/Media/Visual Pinball/Table Videos/' + gameName + file.getExt();
						path = file.getPath();
					}
					break;

				case 'release':
					switch (file.getMimeCategory()) {
						case 'table':
							filename = this.getTableFilename(ctx.state.user, release, file, releaseFiles);
							releaseFiles.push(filename);
							name = 'Visual Pinball/Tables/' + filename;
							break;

						case 'audio':
							name = 'Visual Pinball/Music/' + file.name;
							break;

						case 'script':
							name = 'Visual Pinball/Scripts/' + file.name;
							break;

						case 'archive':
							if (file.metadata && isArray(file.metadata.entries)) {
								if (/rar/i.test(file.getMimeSubtype())) {
									await this.streamZipfile(file, archive);
									continue;
								}
								if (/zip/i.test(file.getMimeSubtype())) {
									await this.streamRarfile(file, archive);
									continue;
								}
							}

							// otherwise, add as normal file
							name = 'Visual Pinball/Tables/' + file.name;
							break;

						default:
							name = 'Visual Pinball/Tables/' + file.name;
					}
					break;

				case 'rom':
					name = 'Visual Pinball/VPinMAME/roms/' + file.name;
					break;
			}
			// per default, put files into the root folder.
			name = name || file.name;
			archive.append(createReadStream(path || file.getPath()), {
				name: name,
				date: file.created_at
			});
		}

		if (release.description) {
			archive.append(release.description, { name: 'README.txt' });
		}
		if (release.acknowledgements) {
			archive.append(release.acknowledgements, { name: 'CREDITS.txt' });
		}
		archive.finalize();
		logger.info('[ReleaseStorage.download] Archive successfully created.');
	}


	/**
	 * This does all the checks and returns 200 if all okay but doesn't actually serve
	 * anything.
	 *
	 * The goal is so the webapp can check first if the download works and display an error
	 * nicely, instead of sending the client to the backend where it will get a JSON error.
	 *
	 * @param {Context} ctx Koa context
	 */
	public async checkDownload(ctx: Context) {
		try {
			await this.collectFiles(ctx, true);
			ctx.set('Content-Length', String(0));
			ctx.response.status = 200;
			ctx.response.body = null;

		} catch (err) {
			ctx.set('Content-Length', String(0));
			ctx.set('X-Error', err.message);
			ctx.response.status = err.code;
			ctx.response.body = null;
		}
	};

	public async thumbRedirect(ctx: Context) {
		const validFormats = fileTypes.getVariationNames(['playfield', 'playfield-fs', 'playfield-ws']);
		const format = ctx.query.format && validFormats.includes(ctx.query.format) ? ctx.query.format : 'medium';

		const release = await state.models.Release.findOne({ id: ctx.params.release_id })
			.populate('versions.files._playfield_image')
			.exec();


		// fail if no release
		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.id).status(404);
		}

		const thumb = state.serializers.Release.findThumb(ctx, release.versions, { thumbFormat: format });
		if (!thumb) {
			throw new ApiError('Cannot find thumb in format "%s".', format).status(404);
		}

		ctx.redirect(thumb.image.url);
	}

	/**
	 * Collects and checks all files based on the HTTP request.
	 *
	 * @param {Context} ctx Koa context
	 * @param {boolean} dryRun If true, don't update counters and don't apply quota.
	 * @returns {Promise<[Release, FileExtended[]]>} Release and collected files.
	 */
	private async collectFiles(ctx: Context, dryRun: boolean): Promise<[Release, FileExtended[]]> {
		let body: DownloadReleaseBody;
		let counters: (() => Promise<any>)[] = [];
		let requestedFiles: FileExtended[] = [];
		let requestedFileIds: string[];
		let numTables = 0;
		if (ctx.query.body) {
			try {
				body = JSON.parse(ctx.query.body);
			} catch (e) {
				throw new ApiError(e, 'Error parsing JSON from URL query.').status(400);
			}
		}
		body = body || ctx.request.body;
		requestedFileIds = body.files;

		logger.info('[ReleaseStorage.collectFiles] RELEASE: %s', JSON.stringify(body));
		if (!body || !isArray(body.files) || !body.files.length) {
			throw new ApiError('You need to provide which files you want to include in the download.').status(422);
		}

		const release = await state.models.Release.findOne({ id: ctx.params.release_id })
			.populate({ path: '_game' })
			.populate({ path: '_game._backglass' })
			.populate({ path: '_game._logo' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._playfield_image' })
			.populate({ path: 'versions.files._playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

		if (!release) {
			throw new ApiError('No such release with ID "%s".', ctx.params.release_id).status(404);
		}
		const hasAccess = await state.models.Release.hasRestrictionAccess(ctx, release._game as Game, release);

		if (!hasAccess) {
			throw new ApiError('No such release with ID "%s".', ctx.params.release_id).status(404);
		}
		await release.assertModeratedView(ctx);

		const media = await state.models.Medium.find({ '_ref.game': release._game._id }).populate('_file').exec();

		// count release and user download
		counters.push(() => release.incrementCounter('downloads'));
		counters.push(() => ctx.state.user.incrementCounter('downloads'));

		release.versions.forEach(version => {

			// check if there are requested table files for that version
			if (!intersection(version.files.map(f => (f._file as File).id), requestedFileIds).length) {
				return; // continue
			}
			version.files.forEach((versionFile, pos) => {
				let file = versionFile._file as FileExtended;
				file.release_version = version.toObject();
				file.release_file = versionFile.toObject();

				if (file.getMimeCategory() === 'table') {
					if (requestedFileIds.includes(file.id)) {
						requestedFiles.push(file);

						// count downloaded flavor
						counters.push(() => state.models.Release.update({ 'versions._id': version._id }, { $inc: { ['versions.$.files.' + pos + '.counter.downloads']: 1 } }).exec());
						numTables++;

						// add media if checked
						if (body.playfield_image && versionFile._playfield_image) {
							requestedFiles.push(versionFile._playfield_image as FileExtended);
						}
						if (body.playfield_video && versionFile._playfield_video) {
							requestedFiles.push(versionFile._playfield_video as FileExtended);
						}
					}

				} else {
					// always add any non-table files
					requestedFiles.push(file);
				}

				// count file download
				counters.push(() => file.incrementCounter('downloads'));
			});

			// count release download
			counters.push(() => state.models.Release.update({ 'versions._id': version._id }, { $inc: { 'versions.$.counter.downloads': 1 } }).exec());
		});

		// count game download
		counters.push(() => (release._game as Game).update({ $inc: { 'counter.downloads': numTables } }).exec());

		// add game media
		if (isArray(body.game_media)) {
			body.game_media.forEach(mediaId => {
				let medium = media.find(m => m.id === mediaId);
				if (!medium) {
					throw new ApiError('Medium with id %s is not part of the game\'s media.', mediaId).status(422);
				}
				requestedFiles.push(medium._file as FileExtended);
				counters.push(() => (medium._file as File).incrementCounter('downloads'));
			});
		}

		// check for roms
		if (isArray(body.roms)) {
			const roms = await state.models.Rom.find({ _game: release._game._id.toString() }).populate('_file').exec();
			body.roms.forEach(romId => {
				let rom = roms.find(r => r.id === romId);
				if (!rom) {
					throw new ApiError('Could not find ROM with id %s for game.', romId).status(422);
				}
				requestedFiles.push(rom._file as FileExtended);
				counters.push(() => (rom._file as File).incrementCounter('downloads'));
			});
		}

		// check for backglasses
		if (body.backglass) {
			const backglass = await state.models.Backglass.findOne({ id: body.backglass }).populate('versions._file').exec();
			if (!backglass) {
				throw new ApiError('Could not find backglass with id %s.', body.backglass).status(422);
			}
			if (!(backglass._game as Schema.Types.ObjectId).equals(release._game._id)) {
				throw new ApiError('Backglass is not the same game as release.', body.backglass).status(422);
			}
			let file = sortBy(backglass.versions, v => -v.released_at)[0]._file;
			requestedFiles.push(file as FileExtended);
			counters.push(() => (file as File).incrementCounter('downloads'));
		}

		if (!requestedFiles.length) {
			throw new ApiError('Requested file IDs did not match any release file.').status(422);
		}

		// check the quota
		let granted: boolean;
		if (!dryRun) {
			granted = await quota.isAllowed(ctx, requestedFiles);
		} else {
			granted = await quota.getCurrent(ctx.state.user).then(q => q.unlimited || quota.getTotalCost(requestedFiles) <= q.remaining);
		}

		if (!granted) {
			throw new ApiError('Not enough quota left.').status(403);
		}

		// update counters
		if (!dryRun) {
			await Promise.all(counters);
		}

		return [release, requestedFiles];
	}

	/**
	 * Returns the name of the table file within the zip archive, depending on the
	 * user's preferences.
	 *
	 * @param user User object
	 * @param release Release object
	 * @param file File object
	 * @param releaseFiles List of already used file names, in order to avoid dupes
	 * @returns {string} File name
	 */
	private getTableFilename(user: User, release: Release, file: FileExtended, releaseFiles: string[]): string {

		const userPrefs: UserPreferences = user.preferences || {} as UserPreferences;
		const tableName = userPrefs.tablefile_name || '{game_title} ({game_manufacturer} {game_year})';
		const flavorTags = userPrefs.flavor_tags || flavors.defaultFileTags();

		const game = release._game as Game;
		const data: { [key: string]: any } = {
			game_title: game.title,
			game_manufacturer: game.manufacturer,
			game_year: game.year,
			release_name: release.name,
			release_version: (file.release_version as ReleaseVersion).version,
			release_compatibility: (file.release_file as ReleaseVersionFile).compatibility.map(v => v.label).join(','),
			release_flavor_orientation: flavorTags.orientation[file.release_file.flavor.orientation],
			release_flavor_lighting: flavorTags.lighting[file.release_file.flavor.lighting],
			original_filename: basename(file.name).replace(/\.[^/.]+$/, '')
		};

		const fileBase = tableName.replace(/({\s*([^}\s]+)\s*})/g, (m1, m2, m3) => isUndefined(data[m3]) ? m1 : data[m3]);

		// check for already used names and suffix with (n)
		let newFilename, n = 0;
		if (releaseFiles.includes(fileBase + file.getExt())) {
			do {
				n++;
				newFilename = fileBase + ' (' + n + ')' + file.getExt();
			} while (releaseFiles.includes(newFilename));
			return newFilename;
		} else {
			return fileBase + file.getExt();
		}
	}

	private getArchivedFilename(entryPath: string, archiveName: string) {
		entryPath = entryPath.replace(/\\/g, '/');
		entryPath = entryPath.replace(/^\//, '');
		if (basename(entryPath) === entryPath) {
			entryPath = archiveName.substr(0, archiveName.length - extname(archiveName).length) + '/' + entryPath;
		}
		return 'Visual Pinball/Tables/' + entryPath;
	}

	/**
	 * Streams the contents of a zip file into the current zip archive.
	 * @param {File} file Zip file to stream (source)
	 * @param archive Destination
	 * @returns {Promise}
	 */
	private async streamZipfile(file: File, archive: Archiver) {
		return new Promise(resolve => {
			let rarFile = new Unrar(file.getPath());
			file.metadata.entries.forEach((entry: any) => {
				let stream = rarFile.stream(entry.filename);
				archive.append(stream, {
					name: this.getArchivedFilename(entry.filename, file.name),
					date: entry.modified_at
				});
				stream.on('error', (err: Error) => {
					logger.info('Error extracting file %s from rar: %s', entry.filename, err);
				});
				stream.on('close', resolve);
			});
		});
	}

	/**
	 * Streams the contents of a rar file into the current zip archive.
	 * @param {File} file RAR file to stream (source)
	 * @param archive Destination
	 * @returns {Promise}
	 */
	private async streamRarfile(file: File, archive: Archiver) {
		return new Promise(resolve => {
			createReadStream(file.getPath())
				.pipe(unzip.Parse())
				.on('entry', entry => {
					if (entry.type === 'File') {
						archive.append(entry, {
							name: this.getArchivedFilename(entry.path, file.name)
						});
					} else {
						entry.autodrain();
					}
				})
				.on('error', (err: Error) => logger.info('Error extracting from zip: %s', err.message))
				.on('close', resolve);
		});
	}
}

interface FileExtended extends File {
	release_version?: ReleaseVersion;
	release_file?: ReleaseVersionFile;
}

interface DownloadReleaseBody {
	files: string[];
	playfield_image: boolean;
	playfield_video: boolean;
	game_media: string[];
	backglass: string;
	roms: string[];
}