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

import { FileReferenceDocument, MetricsDocument, PrettyIdDocument, Types } from 'mongoose';
import { BuildDocument } from '../../../builds/build.document';
import { FileDocument } from '../../../files/file.document';
import { UserDocument } from '../../../users/user.document';
import { ReleaseVersionCounterType } from '../release.version.document';

export interface ReleaseVersionFileDocument extends FileReferenceDocument, PrettyIdDocument, MetricsDocument {
	// model
	_file: FileDocument | Types.ObjectId;
	flavor: ReleaseFileFlavor;
	validation: {
		status: string; // todo type
		message: string;
		validated_at: Date;
		_validated_by?: UserDocument | Types.ObjectId;
		validated_by?: UserDocument;
	};
	_compatibility: BuildDocument[] | Types.ObjectId[];
	_playfield_image?: FileDocument | Types.ObjectId;
	_playfield_video?: FileDocument | Types.ObjectId;
	_playfield_images?: FileDocument[] | Types.ObjectId[];
	_playfield_videos?: FileDocument[] | Types.ObjectId[];
	released_at: Date | string;
	counter: { [T in ReleaseVersionFileCounterType]: number; };

	// serialized
	file: FileDocument;
	compatibility?: BuildDocument[];
	playfield_image?: FileDocument;
	playfield_video?: FileDocument;
	playfield_images?: FileDocument[];
	playfield_videos?: FileDocument[];
	thumb: any; // todo type

	getFileIds(files?: ReleaseVersionFileDocument[]): string[];
	getPlayfieldImageIds(): string[];
}

export interface ReleaseFileFlavor {
	orientation?: string; // todo type
	lighting?: string; // todo type
	[key: string]: string;
}

export type ReleaseVersionFileCounterType = 'downloads';
