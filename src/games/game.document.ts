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

import { config } from '../common/settings';
import { File } from '../files/file';
import { ReleaseDocument } from '../releases/release.document';
import { Game } from './game';

/**
 * Contains the Game's instance methods so they can also be accessed
 * from dehydrated objects.
 */
export class GameDocument {

	/**
	 * @see [[Game.isRestricted]]
	 */
	public static isRestricted(game: Game, what: 'release' | 'backglass'): boolean {
		return game.ipdb.mpu && config.vpdb.restrictions[what].denyMpu.includes(game.ipdb.mpu);
	}

	/**
	 * Returns all file object linked to a game.
	 *
	 * @param {Game} game
	 * @returns {File[]} Linked files
	 */
	public static getLinkedFiles(game: Game): File[] {
		const files: File[] = [game.backglass, game.logo];
		if (game.releases && game.releases.length > 0) {
			const [releaseFiles] = game.releases.map(rls => ReleaseDocument.getLinkedFiles(rls));
			if (releaseFiles && releaseFiles.length > 0) {
				files.push(...releaseFiles);
			}
		}
		if (game.backglasses && game.backglasses.length > 0) {
			const [backglassFiles] = game.backglasses.map(bg => {
				if (bg.versions && bg.versions.length > 0) {
					return bg.versions.map(v => v.file);
				}
				return [];
			});
			if (backglassFiles && backglassFiles.length > 0) {
				files.push(...backglassFiles);
			}
		}
		if (game.media && game.media.length > 0) {
			const mediaFiles = game.media.map(media => media.file);
			if (mediaFiles && mediaFiles.length > 0) {
				files.push(...mediaFiles);
			}
		}
		return files.filter(f => !!f);
	}

}
