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
import { Release, ReleaseCounterType } from './release';
import { FileCounterType } from '../files/file';
import { ReleaseDocument } from './release.document';

export const releaseListCacheCounters: CacheCounterConfig<Release[]>[] = [{
	model: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (releases: Release[], counter: ReleaseCounterType) => releases.reduce((acc:CacheCounterValues, releases) => {
		acc[releases.id] = releases.counter[counter]; return acc }, {}),
	set: (releases: Release[], counter: ReleaseCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => releases.filter(game => game.id === id).forEach(game => game.counter[counter] = values[id]))
}, {
	model: 'file',
	counters: ['downloads'],
	get: (releases: Release[], counter: FileCounterType) => ReleaseDocument.getLinkedFiles(releases).reduce((acc:CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc }, {}),
	set: (releases: Release[], counter: FileCounterType, values: CacheCounterValues) =>
		ReleaseDocument.getLinkedFiles(releases).forEach(file => file.counter[counter] = values[file.id])
}];

export const releaseDetailsCacheCounters: CacheCounterConfig<Release>[] = [{
	model: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (release: Release, counter: ReleaseCounterType) => { return { [release.id]: release.counter[counter] } },
	set: (release: Release, counter: ReleaseCounterType, values: CacheCounterValues) => release.counter[counter] = values[release.id],
	incrementCounter: { counter: 'views', getId: (release: Release) => release.id }
}, {
	model: 'file',
	counters: ['downloads'],
	get: (release: Release, counter: FileCounterType) => ReleaseDocument.getLinkedFiles(release).reduce((acc:CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc }, {}),
	set: (release: Release, counter: FileCounterType, values: CacheCounterValues) =>
		ReleaseDocument.getLinkedFiles(release).forEach(file => file.counter[counter] = values[file.id])
}];
