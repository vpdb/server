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

import { FileDocument } from '../../files/file.document';
import { ReleaseVersionFileDocument } from './file/release.version.file.document';
import { ReleaseVersionDocument } from './release.version.document';

export class ReleaseVersion {

	public static getFileIds(version: ReleaseVersionDocument, versionFiles?: ReleaseVersionFileDocument[]): string[] {
		versionFiles = versionFiles || version.files as ReleaseVersionFileDocument[];
		const releaseFileIds: string[] = versionFiles
			.map(f => f._file as FileDocument)
			.filter(f => !!f)
			.map((file: FileDocument) => file._id.toString());

		const playfieldImageId: string[] = ReleaseVersion.getPlayfieldImageIds(versionFiles);
		const playfieldVideoId: string[] = ReleaseVersion.getPlayfieldVideoIds(versionFiles);

		return [...releaseFileIds, ...playfieldImageId, ...playfieldVideoId];
	}

	public static getPlayfieldImageIds(versionFiles: ReleaseVersionFileDocument[]): string[] {
		return versionFiles
			.map(f => (f._playfield_images || []) as FileDocument[])
			.reduce((acc, img) => { acc.push(...img); return acc; }, [])
			.filter(f => !!f)
			.map((file: FileDocument) => file._id.toString());
	}

	public static getPlayfieldVideoIds(versionFiles: ReleaseVersionFileDocument[]): string[] {
		return versionFiles
			.map(f => (f._playfield_videos || []) as FileDocument[])
			.reduce((acc, vid) => { acc.push(...vid); return acc; }, [])
			.filter(f => !!f)
			.map((file: FileDocument) => file._id.toString());
	}
}
