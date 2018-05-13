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

import { Document, Schema } from 'mongoose';
import { File } from '../files/file';
import { User } from '../users/user';
import { Build } from '../builds/build';

export interface ReleaseVersionFile extends Document {
	_file: File | Schema.Types.ObjectId;
	flavor: {
		orientation: string; // todo type
		lighting: string; // todo type
	};
	validation: {
		status: string; // todo type
		message: string;
		validated_at: Date;
		_validated_by: User | Schema.Types.ObjectId;
	};
	_compatibility: Build[];
	_playfield_image: File | Schema.Types.ObjectId;
	_playfield_video: File | Schema.Types.ObjectId;
	released_at: Date;
	counter: {
		downloads: number;
	};

	// serialized
	file: File;
}