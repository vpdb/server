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

import { File } from '../files/file';
import { ReleaseVersionFile } from './release.version.file';
import { ReleaseVersion } from './release.version';

export class ReleaseVersionDocument {

	public static getFileIds(version: ReleaseVersion, versionFiles?: ReleaseVersionFile[]): string[] {
		versionFiles = versionFiles || version.files as ReleaseVersionFile[];
		const releaseFileIds: string[] = versionFiles
			.map(f => f._file as File)
			.filter(f => !!f)
			.map((file:File) => file._id.toString());

		const playfieldImageId: string[] = ReleaseVersionDocument.getPlayfieldImageIds(versionFiles);
		const playfieldVideoId: string[] = ReleaseVersionDocument.getPlayfieldVideoIds(versionFiles);

		return [...releaseFileIds, ...playfieldImageId, ...playfieldVideoId];
	}

	public static getPlayfieldImageIds(versionFiles: ReleaseVersionFile[]): string[] {
		return versionFiles
			.map(f => f._playfield_image as File)
			.filter(f => !!f)
			.map((file:File) => file._id.toString());
	}

	public static getPlayfieldVideoIds(versionFiles: ReleaseVersionFile[]): string[] {
		return versionFiles
			.map(f => f._playfield_video as File)
			.filter(f => !!f)
			.map((file:File) => file._id.toString());
	}
}