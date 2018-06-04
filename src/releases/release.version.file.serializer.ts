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

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { ReleaseVersionFile } from './release.version.file';
import { Context } from '../common/types/context';
import { Build } from '../builds/build';
import { File } from '../files/file';
import { User } from '../users/user';

export class ReleaseVersionFileSerializer extends Serializer<ReleaseVersionFile> {

	protected _reduced(ctx: Context, doc: ReleaseVersionFile, opts: SerializerOptions): ReleaseVersionFile {
		return undefined;
	}

	protected _simple(ctx: Context, doc: ReleaseVersionFile, opts: SerializerOptions): ReleaseVersionFile {
		return this.serializeReleaseVersionFile(ctx, doc, opts, state.serializers.Build.reduced.bind(state.serializers.Build), state.serializers.File.simple.bind(state.serializers.File));
	}

	protected _detailed(ctx: Context, doc: ReleaseVersionFile, opts: SerializerOptions): ReleaseVersionFile {
		const versionFile = this.serializeReleaseVersionFile(ctx, doc, opts, state.serializers.Build.simple.bind(state.serializers.Build), state.serializers.File.detailed.bind(state.serializers.File)) as ReleaseVersionFile;
		// media
		if (this._populated(doc, '_playfield_image')) {
			versionFile.playfield_image = state.serializers.File.detailed(ctx, doc._playfield_image as File, opts);
		}
		if (doc._playfield_video && this._populated(doc, '_playfield_video')) {
			versionFile.playfield_video = state.serializers.File.detailed(ctx, doc._playfield_video as File, opts);
		}
		return versionFile;
	}

	private serializeReleaseVersionFile(ctx:Context, doc:ReleaseVersionFile, opts:SerializerOptions,
					  buildSerializer: (ctx: Context, doc: Build, opts: SerializerOptions) => Build,
					  fileSerializer: (ctx: Context, doc: File, opts: SerializerOptions) => File): ReleaseVersionFile {

		const versionFile = {
			flavor: (doc.flavor as any).toObject(),
			counter: (doc.counter as any).toObject(),
			released_at: doc.released_at
		} as ReleaseVersionFile;

		// file
		if (this._populated(doc, '_file')) {
			versionFile.file = fileSerializer(ctx, doc._file as File, opts);
		}

		// compat
		if (this._populated(doc, '_compatibility')) {
			versionFile.compatibility = (doc._compatibility as Build[]).map(build => buildSerializer(ctx, build, opts));
		}

		// validation
		if (doc.validation && doc.validation.status) {
			versionFile.validation = {
				status: doc.validation.status,
				message: doc.validation.message,
				validated_at: doc.validation.validated_at,
				validated_by: this._populated(doc, 'validation._validated_by') ? state.serializers.User.reduced(ctx, doc.validation._validated_by as User, opts) : undefined
			};
		}

		// thumb
		if (opts.thumbPerFile && opts.thumbFormat) {
			versionFile.thumb = this.getFileThumb(ctx, doc, opts);
		}
		return versionFile;
	}
}
