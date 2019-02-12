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

import { config } from '../common/settings';
import { FileDocument } from '../files/file.document';
import { Release } from '../releases/release';
import { GameDocument } from './game.document';

/**
 * Contains the Game's instance methods so they can also be accessed
 * from dehydrated objects.
 */
export class Game {

	/**
	 * @see [[GameDocument.isRestricted]]
	 */
	public static isRestricted(game: GameDocument, what: 'release' | 'backglass'): boolean {
		return game.ipdb.mpu && config.vpdb.restrictions[what].denyMpu.includes(game.ipdb.mpu);
	}

	/**
	 * Returns all file object linked to a game.
	 *
	 * @param {GameDocument} game
	 * @returns {FileDocument[]} Linked files
	 */
	public static getLinkedFiles(game: GameDocument): FileDocument[] {
		const files: FileDocument[] = [game.backglass, game.logo];
		if (game.releases && game.releases.length > 0) {
			const [releaseFiles] = game.releases.map(rls => Release.getLinkedFiles(rls));
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
