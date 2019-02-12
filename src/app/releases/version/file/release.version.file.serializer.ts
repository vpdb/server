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

import { BuildDocument } from '../../../builds/build.document';
import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../../../common/serializer';
import { Context } from '../../../common/typings/context';
import { ModelName } from '../../../common/typings/models';
import { FileDocument } from '../../../files/file.document';
import { state } from '../../../state';
import { UserDocument } from '../../../users/user.document';
import { ReleaseVersionFileDocument } from './release.version.file.document';

export class ReleaseVersionFileSerializer extends Serializer<ReleaseVersionFileDocument> {

	public readonly modelName: ModelName = 'ReleaseVersionFile';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [],
		simple: [
			{ path: 'file', modelName: 'File', level: 'simple' },
			{ path: 'validation.validated_by', modelName: 'User', level: 'reduced' },
			{ path: 'compatibility', modelName: 'Build', level: 'reduced' },
		],
		detailed: [
			{ path: 'file', modelName: 'File', level: 'detailed' },
			{ path: 'playfield_image', modelName: 'File', level: 'detailed' },
			{ path: 'playfield_video', modelName: 'File', level: 'detailed' },
			{ path: 'compatibility', modelName: 'Build', level: 'simple' },
			{ path: 'validation.validated_by', modelName: 'User', level: 'reduced' },
		],
	};
	public idField = 'file.id';

	protected _reduced(ctx: Context, doc: ReleaseVersionFileDocument, opts: SerializerOptions): ReleaseVersionFileDocument {
		return undefined;
	}

	protected _simple(ctx: Context, doc: ReleaseVersionFileDocument, opts: SerializerOptions): ReleaseVersionFileDocument {
		return this.serializeReleaseVersionFile(ctx, doc, opts, state.serializers.Build.reduced.bind(state.serializers.Build), state.serializers.File.simple.bind(state.serializers.File));
	}

	protected _detailed(ctx: Context, doc: ReleaseVersionFileDocument, opts: SerializerOptions): ReleaseVersionFileDocument {
		const versionFile = this.serializeReleaseVersionFile(ctx, doc, opts, state.serializers.Build.simple.bind(state.serializers.Build), state.serializers.File.detailed.bind(state.serializers.File)) as ReleaseVersionFileDocument;
		// media
		if (this._populated(doc, '_playfield_image')) {
			versionFile.playfield_image = state.serializers.File.detailed(ctx, doc._playfield_image as FileDocument, opts);
		}
		if (doc._playfield_video && this._populated(doc, '_playfield_video')) {
			versionFile.playfield_video = state.serializers.File.detailed(ctx, doc._playfield_video as FileDocument, opts);
		}
		versionFile.counter = doc.counter;
		return versionFile;
	}

	private serializeReleaseVersionFile(ctx: Context, doc: ReleaseVersionFileDocument, opts: SerializerOptions,
										buildSerializer: (ctx: Context, doc: BuildDocument, opts: SerializerOptions) => BuildDocument,
										fileSerializer: (ctx: Context, doc: FileDocument, opts: SerializerOptions) => FileDocument): ReleaseVersionFileDocument {

		const versionFile = {
			flavor: doc.flavor,
			released_at: doc.released_at,
		} as ReleaseVersionFileDocument;

		// file
		if (this._populated(doc, '_file')) {
			versionFile.file = fileSerializer(ctx, doc._file as FileDocument, opts);
		}

		// compat
		if (this._populated(doc, '_compatibility')) {
			versionFile.compatibility = (doc._compatibility as BuildDocument[]).map(build => buildSerializer(ctx, build, opts));
		}

		// validation
		if (doc.validation && doc.validation.status) {
			versionFile.validation = {
				status: doc.validation.status,
				message: doc.validation.message,
				validated_at: doc.validation.validated_at,
				validated_by: this._populated(doc, 'validation._validated_by') ? state.serializers.User.reduced(ctx, doc.validation._validated_by as UserDocument, opts) : undefined,
			};
		}

		// thumb
		if (opts.thumbPerFile && opts.thumbFormat) {
			versionFile.thumb = this.getFileThumb(ctx, doc, opts);
		}
		return versionFile;
	}
}
