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
import { pick, sortBy, sumBy } from 'lodash';
import sanitize = require('mongo-sanitize');

import { BuildDocument } from '../builds/build.document';
import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { Context } from '../common/typings/context';
import { ReleaseDocument } from '../releases/release.document';
import { TableBlock, TableBlockBase, TableBlockMatch, TableBlockMatchResult } from '../releases/release.tableblock';
import { ReleaseVersionFileDocument } from '../releases/version/file/release.version.file.document';
import { ReleaseVersionDocument } from '../releases/version/release.version.document';
import { state } from '../state';
import { FileDocument } from './file.document';

export class FileBlockmatchApi extends Api {

	/**
	 * Looks for similar table files.
	 *
	 * @param {Application.Context} ctx Koa context
	 */
	public async blockmatch(ctx: Context) {

		const includeSameRelease = !!ctx.query.include_same_release;
		const rlsFields = ['_game', 'authors._user', 'versions.files._file', 'versions.files._compatibility'];
		const threshold = 50; // sum of matched bytes and object percentage must be >50%
		const file = await state.models.File.findOne({ id: sanitize(ctx.params.id) });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if no table file
		if (file.getMimeCategory() !== 'table') {
			throw new ApiError('Can only match table files, this is a %s', file.getMimeCategory(), ctx.params.id).status(400);
		}
		const release = await state.models.Release.findOne({ 'versions.files._file': file._id }).populate(rlsFields.join(' ')).exec();

		// fail if not found
		/* istanbul ignore if */
		if (!release) {
			throw new ApiError('Release reference missing.', ctx.params.id).status(400);
		}

		const result: TableBlockMatchResult = this.populateBlockmatch<TableBlockMatchResult>(ctx, release, file._id.toString());
		const matches = new Map<string, TableBlock[]>();
		const blocks = await state.models.TableBlock.find({ _files: file._id }).exec();
		// split blocks: { <file._id>: [ matched blocks ] }
		blocks.forEach((block: TableBlock) => {
			(block._files as FileDocument[]).forEach(f => {
				// don't match own id
				if (f.equals(file._id)) {
					return;
				}
				const fid = f.toString();
				if (!matches.has(fid)) {
					matches.set(fid, []);
				}
				matches.get(fid).push(block);
			});
		});
		// FIXME just fetch files, calc percentage, filter, THEN fetch releases for performance boost.
		const matchedReleases = await state.models.Release.find({ 'versions.files._file': { $in: Array.from(matches.keys()) } }).populate(rlsFields.join(' ')).exec();

		// map <file._id>: <release>
		const releases = new Map<string, ReleaseDocument>();
		matchedReleases.forEach(rls => {
			rls.versions.forEach(version => {
				version.files.forEach(f => {
					releases.set((f._file as FileDocument)._id.toString(), rls);
				});
			});
		});
		const totalBytes = sumBy(blocks, b => b.bytes);
		result.matches = [];
		for (const [key, matchedBlocks] of matches) {
			const matchedBytes = sumBy(matchedBlocks, b => b.bytes);
			const match = this.populateBlockmatch<TableBlockMatch>(ctx, releases.get(key), key, {
				matchedCount: matchedBlocks.length,
				matchedBytes,
				countPercentage: matchedBlocks.length / blocks.length * 100,
				bytesPercentage: matchedBytes / totalBytes * 100,
			});
			result.matches.push(match);
		}
		result.matches = result.matches.filter(m => m.release && m.countPercentage + m.bytesPercentage > threshold);
		if (!includeSameRelease) {
			result.matches = result.matches.filter(m => m.release.id !== release.id);
		}
		result.matches = sortBy(result.matches, m => -(m.countPercentage + m.bytesPercentage));
		this.success(ctx, result);
	}

	/**
	 * Searches a file with a given ID within a release and updates
	 * a given object with release, game, version and file.
	 * @param {Application.Context} ctx Koa context
	 * @param {ReleaseDocument} release Release to search in
	 * @param {string} fileId File ID to search for  (database _id as string)
	 * @param {object} base Object to be updated
	 */
	private populateBlockmatch<T extends TableBlockBase>(ctx: Context, release: ReleaseDocument, fileId: string, base: T = {} as T): T {
		if (!release) {
			return base;
		}
		const rls = state.serializers.Release.simple(ctx, release);
		base.release = pick(rls, ['id', 'name', 'created_at', 'authors']) as ReleaseDocument;
		base.game = rls.game;
		release.versions.forEach(version => {
			version.files.forEach(versionFile => {
				if ((versionFile._file as FileDocument)._id.toString() === fileId) {
					base.version = pick(version.toObject(), ['version', 'released_at']) as ReleaseVersionDocument;
					const f = versionFile.toObject();
					base.file = pick(f, ['released_at', 'flavor']) as ReleaseVersionFileDocument;
					base.file.compatibility = f._compatibility.map((c: BuildDocument) => pick(c, ['id', 'label']));
					base.file.file = state.serializers.File.simple(ctx, versionFile._file as FileDocument);
				}
			});
		});
		return base;
	}

}
