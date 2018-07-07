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

import { compact, flatten, map } from 'lodash';
import { ModeratedDocument, Types } from 'mongoose';

import { isArray } from 'util';
import { File } from '../files/file';
import { state } from '../state';
import { User } from '../users/user';
import { Release } from './release';

export class ReleaseDocument {

	/**
	 * Updates game counters when moderation status of a release has changed.
	 *
	 * @see [[Release.moderationChanged]]
	 * @param {Release} release Release
	 * @param {{isApproved: boolean, isRefused: boolean}} previousModeration
	 * @param {{isApproved: boolean, isRefused: boolean}} moderation
	 * @returns {Promise<Game>} Updated game
	 */
	public static async moderationChanged(release: Release, previousModeration: { isApproved: boolean, isRefused: boolean }, moderation: { isApproved: boolean, isRefused: boolean }): Promise<ModeratedDocument> {
		if (previousModeration.isApproved && !moderation.isApproved) {
			return state.models.Game.update({ _id: release._game }, { $inc: { 'counter.releases': -1 } });
		}
		if (!previousModeration.isApproved && moderation.isApproved) {
			return state.models.Game.update({ _id: release._game }, { $inc: { 'counter.releases': 1 } });
		}
	}

	/**
	 * Returns all file IDs from a populated release.
	 *
	 * @see [[Release.getFileIds]]
	 * @param {Release} release Release
	 * @returns {string[]} File IDs
	 */
	public static getFileIds(release: Release): string[] {
		const files = flatten(map(release.versions, 'files'));
		const tableFileIds = map(files, '_file').map(file => file ? file._id.toString() : null);
		const playfieldImageId = compact(map(files, '_playfield_image')).map(file => file._id.toString());
		const playfieldVideoId = compact(map(files, '_playfield_video')).map(file => file._id.toString());
		return compact(flatten([...tableFileIds, playfieldImageId, playfieldVideoId]));
	}

	/**
	 * Returns all playfield image IDs from a populated release.
	 *
	 * @param {Release} release
	 * @returns {string[]} File IDs
	 */
	public static getPlayfieldImageIds(release: Release): string[] {
		const files = flatten(map(release.versions, 'files'));
		return compact(map(files, '_playfield_image')).map(file => file._id.toString());
	}

	/**
	 * Checks if a release is created by given user.
	 *
	 * @param {Release} release Release to check.
	 * @param {User} user User to check
	 * @returns {boolean} True if user is the release's creator, false otherwise.
	 */
	public static isCreatedBy(release: Release, user: User): boolean {
		if (!user) {
			return false;
		}
		if (release._created_by._id instanceof Types.ObjectId) {
			return release._created_by._id.equals(user._id);
		}
		const userId = user._id instanceof Types.ObjectId ? user._id.toString() : user._id;
		return release._created_by === userId;
	}

	/**
	 * Returns all file object linked to a release.
	 *
	 * @param {Release} release Serialized release
	 * @returns {File[]} Linked files
	 */
	public static getLinkedFiles(release: Release | Release[]): File[] {
		let files: File[] = [];
		if (isArray(release)) {
			[ files ] = release.map(ReleaseDocument.getLinkedFiles);
			return files || [];
		}
		if (release.versions && release.versions.length > 0) {
			[[files]] = release.versions.map(v => {
				if (v.files && v.files.length > 0) {
					return v.files.map(f => [f.playfield_image, f.playfield_video, f.file]);
				}
				return [];
			});
		}
		return files.filter(f => !!f);
	}
}
