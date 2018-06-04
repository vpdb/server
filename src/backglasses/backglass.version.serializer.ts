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

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { BackglassVersion } from './backglass.version';
import { Context } from '../common/types/context';
import { File } from '../files/file';

export class BackglassVersionSerializer extends Serializer<BackglassVersion> {

	protected _reduced(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._serialize(ctx, doc, opts, state.serializers.File.reduced.bind(state.serializers.File));
	}

	protected _simple(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._serialize(ctx, doc, opts, state.serializers.File.simple.bind(state.serializers.File));
	}

	protected _detailed(ctx: Context, doc: BackglassVersion, opts: SerializerOptions): BackglassVersion {
		return this._simple(ctx, doc, opts);
	}

	private _serialize(ctx: Context, doc: BackglassVersion, opts: SerializerOptions,
					   fileSerializer: (ctx: Context, doc: File, opts: SerializerOptions) => File): BackglassVersion {

		const backglassVersion = pick(doc, ['version', 'changes', 'released_at']) as BackglassVersion;
		backglassVersion.counter = (doc.counter as any).toObject();
		if (this._populated(doc, '_file')) {
			backglassVersion.file = fileSerializer(ctx, doc._file as File, opts);
		}
		return backglassVersion;
	}
}