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

import { FileReferenceDocument, GameReferenceDocument, PrettyIdDocument, Types } from 'mongoose';
import { File } from '../files/file';
import { User } from '../users/user';

export interface Rom extends GameReferenceDocument, PrettyIdDocument, FileReferenceDocument {
	id: string;
	_file: File | Types.ObjectId;
	_ipdb_number: number;
	rom_files: Array<{
		filename: string;
		bytes: number;
		crc: number;
		modified_at: Date;
	}>;
	version: string;
	languages: string[];
	notes: string;
	created_at: Date;
	_created_by: User | Types.ObjectId;

	// serialized
	file: File;
	created_by: User;
}
