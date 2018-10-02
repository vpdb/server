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
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { ReleaseDocument } from './release.document';
import { ReleaseVersionFileDocument } from './version/file/release.version.file.document';

export class Release {

	/**
	 * Updates game counters when moderation status of a release has changed.
	 *
	 * @see [[ReleaseDocument.moderationChanged]]
	 * @param {ReleaseDocument} release Release
	 * @param {{isApproved: boolean, isRefused: boolean}} previousModeration
	 * @param {{isApproved: boolean, isRefused: boolean}} moderation
	 * @returns {Promise<Game>} Updated game
	 */
	public static async moderationChanged(release: ReleaseDocument, previousModeration: { isApproved: boolean, isRefused: boolean }, moderation: { isApproved: boolean, isRefused: boolean }): Promise<ModeratedDocument> {
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
	 * @see [[ReleaseDocument.getFileIds]]
	 * @param {ReleaseDocument} release Release
	 * @returns {string[]} File IDs
	 */
	public static getFileIds(release: ReleaseDocument): string[] {
		const versionFiles = flatten(release.versions.map(version => version.files));
		const tableFiles = versionFiles.map(file => file._file);
		const playfieldImages = versionFiles.reduce((acc, file) => { acc.push(...file._playfield_images); return acc; }, []);
		const playfieldVideos = versionFiles.reduce((acc, file) => { acc.push(...file._playfield_videos); return acc; }, []);

		return [...tableFiles, ...playfieldImages, ...playfieldVideos]
			.filter(file => !!file)
			.map(file => file._id.toString());
	}

	/**
	 * Returns all playfield image IDs from a populated release.
	 *
	 * @param {ReleaseDocument} release
	 * @returns {string[]} File IDs
	 */
	public static getPlayfieldImageIds(release: ReleaseDocument): string[] {
		const versionFiles = flatten(release.versions.map(version => version.files));
		const playfieldImages = versionFiles.reduce((acc, file) => { acc.push(...file._playfield_images); return acc; }, []);
		return playfieldImages.filter(file => !!file).map(file => file._id.toString());
	}

	/**
	 * Checks if a release is created by given user.
	 *
	 * @param {ReleaseDocument} release Release to check.
	 * @param {UserDocument} user User to check
	 * @returns {boolean} True if user is the release's creator, false otherwise.
	 */
	public static isCreatedBy(release: ReleaseDocument, user: UserDocument): boolean {
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
	 * Returns all file objects linked to a release.
	 *
	 * @param {ReleaseDocument} release Serialized release
	 * @returns {FileDocument[]} Linked files
	 */
	public static getLinkedFiles(release: ReleaseDocument | ReleaseDocument[]): FileDocument[] {
		let files: FileDocument[] = [];
		if (isArray(release)) {
			[ files ] = release.map(Release.getLinkedFiles);
			return files || [];
		}
		if (release.versions && release.versions.length > 0) {
			[[files]] = release.versions.map(v => {
				if (v.files && v.files.length > 0) {
					return v.files.map(f => [...(f.playfield_images || []), ...(f.playfield_videos || []), f.file]);
				}
				return [];
			});
		}
		return files.filter(f => !!f);
	}

	/**
	 * Returns all release version file objects linked to a release.
	 *
	 * @param {ReleaseDocument} release Serialized release
	 * @returns {ReleaseVersionFileDocument[]} Linked release version files
	 */
	public static getLinkedReleaseFiles(release: ReleaseDocument | ReleaseDocument[]): ReleaseVersionFileDocument[] {
		let releaseVersionFiles: ReleaseVersionFileDocument[] = [];
		if (isArray(release)) {
			[ releaseVersionFiles ] = release.map(Release.getLinkedReleaseFiles);
			return releaseVersionFiles || [];
		}
		if (release.versions && release.versions.length > 0) {
			[releaseVersionFiles] = release.versions.map(v => {
				if (v.files && v.files.length > 0) {
					return v.files;
				}
				return [];
			});
		}
		return releaseVersionFiles.filter(f => !!f);
	}
}
