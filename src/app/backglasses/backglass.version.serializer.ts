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

import { pick } from 'lodash';

import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { BackglassVersion } from './backglass.version';

export class BackglassVersionSerializer extends Serializer<BackglassVersion> {

	public readonly modelName: ModelName = 'BackglassVersion';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [ { path: 'file', modelName: 'File', level: 'reduced' } ],
		simple: [ { path: 'file', modelName: 'File', level: 'simple' } ],
		detailed: [ { path: 'file', modelName: 'File', level: 'simple' } ],
	};

	protected _reduced(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._serialize(ctx, doc, opts, state.serializers.File.reduced.bind(state.serializers.File));
	}

	protected _simple(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._serialize(ctx, doc, opts, state.serializers.File.simple.bind(state.serializers.File));
	}

	/* istanbul ignore next */
	protected _detailed(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._simple(ctx, doc, opts);
	}

	private _serialize(ctx: Context, doc: BackglassVersion, opts: SerializerOptions,
					fileSerializer: (ctx: Context, doc: FileDocument, opts: SerializerOptions) => FileDocument): BackglassVersion {

		const backglassVersion = pick(doc, ['version', 'changes', 'released_at']) as BackglassVersion;
		backglassVersion.counter = doc.counter;
		if (this._populated(doc, '_file')) {
			backglassVersion.file = fileSerializer(ctx, doc._file as FileDocument, opts);
		}
		return backglassVersion;
	}
}
