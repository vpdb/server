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

import { CacheCounterConfig, CacheCounterValues } from '../common/api.cache';
import { FileCounterType } from '../files/file.document';
import { Release } from './release';
import { ReleaseCounterType, ReleaseDocument } from './release.document';
import { ReleaseVersionFileCounterType } from './version/file/release.version.file.document';
import { ReleaseVersionCounterType } from './version/release.version.document';

export const releaseDetailsCacheCounters: Array<CacheCounterConfig<ReleaseDocument>> = [{
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (release: ReleaseDocument, counter: ReleaseCounterType) => ({ [release.id]: release.counter[counter] }),
	set: (release: ReleaseDocument, counter: ReleaseCounterType, values: CacheCounterValues) => release.counter[counter] = values[release.id],
	incrementCounter: { counter: 'views', getId: (release: ReleaseDocument) => release.id },
}, {
	modelName: 'release.versions',
	counters: ['downloads', 'comments'],
	get: (releaseFromDb: ReleaseDocument, counter: ReleaseVersionCounterType) => releaseFromDb.versions.reduce((acc: CacheCounterValues, version) => {
		const key = [releaseFromDb.id, version.version].join(',');
		acc[key] = version.counter[counter];
		return acc;
	}, {}),
	set: (releaseFromCache: ReleaseDocument, counter: ReleaseVersionCounterType, values: CacheCounterValues) => {
		for (const key of Object.keys(values)) {
			const id = key.split(',')[1];
			const version = releaseFromCache.versions.find(v => v.version === id);
			version.counter[counter] = values[key];
		}
	},
}, {
	modelName: 'release.versions.files',
	counters: ['downloads'],
	get: (releaseFromDb: ReleaseDocument, counter: ReleaseVersionFileCounterType) => Release.getLinkedReleaseFiles(releaseFromDb).reduce((acc: CacheCounterValues, versionFile) => {
		const key = [releaseFromDb.id, versionFile.file.id].join(',');
		acc[key] = versionFile.counter[counter];
		return acc;
	}, {}),
	set: (releaseFromCache: ReleaseDocument, counter: ReleaseVersionFileCounterType, values: CacheCounterValues) => {
		for (const key of Object.keys(values)) {
			const id = key.split(',')[1];
			const files = Release.getLinkedReleaseFiles(releaseFromCache);
			const file = files.find(versionFile => versionFile.file.id === id);
			file.counter[counter] = values[key];
		}
	},
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (release: ReleaseDocument, counter: FileCounterType) => Release.getLinkedFiles(release).reduce((acc: CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc; }, {}),
	set: (release: ReleaseDocument, counter: FileCounterType, values: CacheCounterValues) =>
		Release.getLinkedFiles(release).forEach(file => file.counter[counter] = values[file.id]),
}];

export const releaseListCacheCounters: Array<CacheCounterConfig<ReleaseDocument[]>> = [{
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (releases: ReleaseDocument[], counter: ReleaseCounterType) => releases.reduce((acc: CacheCounterValues, rls) => {
		acc[rls.id] = rls.counter[counter]; return acc; }, {}),
	set: (releases: ReleaseDocument[], counter: ReleaseCounterType, values: CacheCounterValues) => Object.keys(values)
		.forEach(id => releases.find(rls => rls.id === id).counter[counter] = values[id]),
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (releases: ReleaseDocument[], counter: FileCounterType) => Release.getLinkedFiles(releases).reduce((acc: CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc; }, {}),
	set: (releases: ReleaseDocument[], counter: FileCounterType, values: CacheCounterValues) =>
		Release.getLinkedFiles(releases).forEach(file => file.counter[counter] = values[file.id]),
}];
