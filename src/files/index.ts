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

import mongoose from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { ApiRouter } from '../common/api.router';
import { state } from '../state';
import { FileApiRouter } from './file.api.router';
import { FileDocument } from './file.document';
import { FileModel, fileSchema } from './file.schema';
import { FileSerializer } from './file.serializer';
import { FileProtectedStorageRouter, FilePublicStorageRouter } from './file.storage.router';

export class FilesApiEndPoint extends EndPoint {

	public readonly name: string = 'Files API';
	private readonly router = new FileApiRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}

	public registerModel(): EndPoint {
		state.models.File = mongoose.model<FileDocument, FileModel>('File', fileSchema);
		return this;
	}

	public registerSerializer(): EndPoint {
		state.serializers.File = new FileSerializer();
		return this;
	}
}

export class FilesProtectedStorageEndPoint extends EndPoint {

	public readonly name: string = 'Storage Protected Files API';
	private readonly router = new FileProtectedStorageRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}
}

export class FilesPublicStorageEndPoint extends EndPoint {

	public readonly name: string = 'Storage Public Files API';
	private readonly router = new FilePublicStorageRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}
}
