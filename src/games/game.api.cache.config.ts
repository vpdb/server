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
import { ReleaseCounterType } from '../releases/release.doument';
import { GameDocument, GameCounterType } from './game.document';
import { Game } from './game';

export const gameListCacheCounters: Array<CacheCounterConfig<GameDocument[]>> = [{
	modelName: 'game',
	counters: ['releases', 'views', 'downloads', 'comments', 'stars'],
	get: (games: GameDocument[], counter: GameCounterType) => games.reduce((acc: CacheCounterValues, game) => {
		acc[game.id] = game.counter[counter]; return acc; }, {}),
	set: (games: GameDocument[], counter: GameCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => games.filter(game => game.id === id).forEach(game => game.counter[counter] = values[id])),
}];

export const gameDetailsCacheCounters: Array<CacheCounterConfig<GameDocument>> = [{
	modelName: 'game',
	counters: ['releases', 'views', 'downloads', 'comments', 'stars'],
	get: (game: GameDocument, counter: GameCounterType) => ({ [game.id]: game.counter[counter] }),
	set: (game: GameDocument, counter: GameCounterType, values: CacheCounterValues) => game.counter[counter] = values[game.id],
	incrementCounter: { counter: 'views', getId: (game: GameDocument) => game.id },
}, {
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (game: GameDocument, counter: ReleaseCounterType) => game.releases.reduce((acc: CacheCounterValues, rls) => {
		acc[rls.id] = rls.counter[counter]; return acc; }, {}),
	set: (game: GameDocument, counter: ReleaseCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => game.releases.filter(rls => rls.id === id).forEach(rls => rls.counter[counter] = values[id])),
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (game: GameDocument, counter: FileCounterType) => Game.getLinkedFiles(game).reduce((acc: CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc; }, {}),
	set: (game: GameDocument, counter: FileCounterType, values: CacheCounterValues) =>
		Game.getLinkedFiles(game).forEach(file => file.counter[counter] = values[file.id]),
}];
