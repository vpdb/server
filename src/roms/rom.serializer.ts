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
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { RomDocument } from './rom.document';

export class RomSerializer extends Serializer<RomDocument> {

	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [
			{ path: 'file', modelName: 'File', level: 'simple' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
		],
		simple: [
			{ path: 'file', modelName: 'File', level: 'simple' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
		],
		detailed: [
			{ path: 'file', modelName: 'File', level: 'simple' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
		],
	};

	protected _reduced(ctx: Context, doc: RomDocument, opts: SerializerOptions): RomDocument {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: RomDocument, opts: SerializerOptions): RomDocument {
		const rom = pick(doc, ['id', 'version', 'notes', 'languages']) as RomDocument;
		rom.rom_files = doc.rom_files.map((f: any) => pick(f, ['filename', 'bytes', 'crc', 'modified_at']));

		// file
		if (this._populated(doc, '_file')) {
			rom.file = state.serializers.File.simple(ctx, doc._file as FileDocument, opts);
		}

		// creator
		if (this._populated(doc, '_created_by')) {
			rom.created_by = state.serializers.User.reduced(ctx, doc._created_by as UserDocument, opts);
		}
		return rom;
	}
	protected _detailed(ctx: Context, doc: RomDocument, opts: SerializerOptions): RomDocument {
		return this._simple(ctx, doc, opts);
	}
}
