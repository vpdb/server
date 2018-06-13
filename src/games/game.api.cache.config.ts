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
import { Game, GameCounterType } from './game';
import { ReleaseCounterType } from '../releases/release';
import { FileCounterType } from '../files/file';
import { GameDocument } from './game.document';

export const gameListCacheCounters: CacheCounterConfig<Game[]>[] = [{
	modelName: 'game',
	counters: ['releases', 'views', 'downloads', 'comments', 'stars'],
	get: (games: Game[], counter: GameCounterType) => games.reduce((acc:CacheCounterValues, game) => {
		acc[game.id] = game.counter[counter]; return acc }, {}),
	set: (games: Game[], counter: GameCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => games.filter(game => game.id === id).forEach(game => game.counter[counter] = values[id]))
}];

export const gameDetailsCacheCounters: CacheCounterConfig<Game>[] = [{
	modelName: 'game',
	counters: ['releases', 'views', 'downloads', 'comments', 'stars'],
	get: (game: Game, counter: GameCounterType) => { return { [game.id]: game.counter[counter] } },
	set: (game: Game, counter: GameCounterType, values: CacheCounterValues) => game.counter[counter] = values[game.id],
	incrementCounter: { counter: 'views', getId: (game: Game) => game.id }
}, {
	modelName: 'release',
	counters: ['downloads', 'comments', 'stars', 'views'],
	get: (game: Game, counter: ReleaseCounterType) => game.releases.reduce((acc:CacheCounterValues, rls) => {
		acc[rls.id] = rls.counter[counter]; return acc }, {} ),
	set: (game: Game, counter: ReleaseCounterType, values: CacheCounterValues) => Object.keys(values).forEach(
		id => game.releases.filter(rls => rls.id === id).forEach(rls => rls.counter[counter] = values[id]))
}, {
	modelName: 'file',
	counters: ['downloads'],
	get: (game: Game, counter: FileCounterType) => GameDocument.getLinkedFiles(game).reduce((acc:CacheCounterValues, file) => {
		acc[file.id] = file.counter[counter]; return acc }, {}),
	set: (game: Game, counter: FileCounterType, values: CacheCounterValues) =>
		GameDocument.getLinkedFiles(game).forEach(file => file.counter[counter] = values[file.id])
}];
