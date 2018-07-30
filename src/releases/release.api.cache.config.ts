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

import { CacheCounterConfig, CacheCounterValues } from '../common/api.cache';
import { FileCounterType } from '../files/file.document';
import { Release } from './release';
import { ReleaseCounterType, ReleaseDocument } from './release.document';
import { ReleaseVersionFileCounterType } from './version/file/release.version.file.document';
import { ReleaseVersionCounterType } from './version/release.version.document';

export const releaseListCacheCounters: Array<CacheCounterConfig<ReleaseDocument[]>> = [{
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (releases: ReleaseDocument[], counter: ReleaseCounterType) => releases.reduce((acc: CacheCounterValues, rls) => {
		acc[rls.id] = rls.counter[counter]; return acc; }, {}),
	set: (releases: ReleaseDocument[], counter: ReleaseCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => releases.filter(rls => rls.id === id).forEach(rls => rls.counter[counter] = values[id])),
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (releases: ReleaseDocument[], counter: FileCounterType) => Release.getLinkedFiles(releases).reduce((acc: CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc; }, {}),
	set: (releases: ReleaseDocument[], counter: FileCounterType, values: CacheCounterValues) =>
		Release.getLinkedFiles(releases).forEach(file => file.counter[counter] = values[file.id]),
}];

export const releaseDetailsCacheCounters: Array<CacheCounterConfig<ReleaseDocument>> = [{
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (release: ReleaseDocument, counter: ReleaseCounterType) => ({ [release.id]: release.counter[counter] }),
	set: (release: ReleaseDocument, counter: ReleaseCounterType, values: CacheCounterValues) => release.counter[counter] = values[release.id],
	incrementCounter: { counter: 'views', getId: (release: ReleaseDocument) => release.id },
}, {
	modelName: 'release.versions',
	counters: ['downloads', 'comments'],
	get: (release: ReleaseDocument, counter: ReleaseVersionCounterType) => release.versions.reduce((acc: CacheCounterValues, version) => {
		acc[[release.id, version.version].join(',')] = version.counter[counter]; return acc; }, {}),
	set: (release: ReleaseDocument, counter: ReleaseVersionCounterType, values: CacheCounterValues) => Object.keys(values)
		.forEach(
			id => release.versions
				.filter(version => version.version === id.split(',')[1])
				.forEach(version => version.counter[counter] = values[id])),
}, {
	modelName: 'release.versions.files',
	counters: ['downloads'],
	get: (release: ReleaseDocument, counter: ReleaseVersionFileCounterType) => Release.getLinkedReleaseFiles(release).reduce((acc: CacheCounterValues, versionFile) => {
		acc[[release.id, versionFile.file.id].join(',')] = versionFile.counter[counter]; return acc; }, {}),
	set: (release: ReleaseDocument, counter: ReleaseVersionFileCounterType, values: CacheCounterValues) => Object.keys(values)
		.forEach(
			id => Release.getLinkedReleaseFiles(release)
				.filter(versionFile => versionFile.file.id === id.split(',')[1])
				.forEach(versionFile => versionFile.counter[counter] = values[id])),
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (release: ReleaseDocument, counter: FileCounterType) => Release.getLinkedFiles(release).reduce((acc: CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc; }, {}),
	set: (release: ReleaseDocument, counter: FileCounterType, values: CacheCounterValues) =>
		Release.getLinkedFiles(release).forEach(file => file.counter[counter] = values[file.id]),
}];
