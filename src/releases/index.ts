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
import { ReleaseApiRouter } from './release.api.router';
import { ReleaseDocument } from './release.document';
import { ReleaseModel, releaseSchema } from './release.schema';
import { ReleaseSerializer } from './release.serializer';
import { ReleaseStorageRouter } from './release.storage.router';
import { TableBlock } from './release.tableblock';
import { tableBlockSchema } from './release.tableblock.schema';
import { ReleaseVersionFileDocument } from './version/file/release.version.file.document';
import { ReleaseVersionFileModel, releaseVersionFileSchema } from './version/file/release.version.file.schema';
import { ReleaseVersionFileSerializer } from './version/file/release.version.file.serializer';
import { ReleaseVersionDocument } from './version/release.version.document';
import { ReleaseVersionModel, releaseVersionSchema } from './version/release.version.schema';
import { ReleaseVersionSerializer } from './version/release.version.serializer';

export class ReleaseEndPoint extends EndPoint {

	public readonly name: string = 'Release API';
	private readonly router = new ReleaseApiRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}

	public registerModel(): EndPoint {
		state.models.Release = mongoose.model<ReleaseDocument>('Release', releaseSchema) as ReleaseModel;
		state.models.ReleaseVersion = mongoose.model<ReleaseVersionDocument, ReleaseVersionModel>('ReleaseVersion', releaseVersionSchema);
		state.models.ReleaseVersionFile = mongoose.model<ReleaseVersionFileDocument, ReleaseVersionFileModel>('ReleaseVersionFile', releaseVersionFileSchema);
		state.models.TableBlock = mongoose.model<TableBlock>('TableBlock', tableBlockSchema);
		return this;
	}

	public registerSerializer(): EndPoint {
		state.serializers.Release = new ReleaseSerializer();
		state.serializers.ReleaseVersion = new ReleaseVersionSerializer();
		state.serializers.ReleaseVersionFile = new ReleaseVersionFileSerializer();
		return this;
	}
}

export class ReleaseStorageEndPoint extends EndPoint {

	public readonly name: string = 'Release storage API';
	private readonly router = new ReleaseStorageRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}
}
