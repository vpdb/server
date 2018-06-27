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

import { Serializer, SerializerOptions } from '../common/serializer';
import { Rom } from './rom';
import { Context } from '../common/typings/context';
import { pick } from 'lodash';
import { state } from '../state';
import { File } from '../files/file';
import { User } from '../users/user';

export class RomSerializer extends Serializer<Rom> {

	protected _reduced(ctx: Context, doc: Rom, opts: SerializerOptions): Rom {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: Rom, opts: SerializerOptions): Rom {
		const rom = pick(doc, ['id', 'version', 'notes', 'languages']) as Rom;
		rom.rom_files = doc.rom_files.map((f:any) => pick(f, ['filename', 'bytes', 'crc', 'modified_at']));

		// file
		if (this._populated(doc, '_file')) {
			rom.file = state.serializers.File.simple(ctx, doc._file as File, opts);
		}

		// creator
		if (this._populated(doc, '_created_by')) {
			rom.created_by = state.serializers.User.reduced(ctx, doc._created_by as User, opts);
		}
		return rom;
	}
	protected _detailed(ctx: Context, doc: Rom, opts: SerializerOptions): Rom {
		return this._simple(ctx, doc, opts);
	}
}