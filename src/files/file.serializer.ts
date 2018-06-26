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

import { assign, pick } from 'lodash';
import { quota } from '../common/quota';
import { Context } from '../common/types/context';
import { Serializer, SerializerOptions } from '../common/serializer';
import { File } from './file';
import { Metadata } from './metadata/metadata';
import { FileDocument } from './file.document';

export class FileSerializer extends Serializer<File> {

	protected _reduced(ctx: Context, doc: File, opts: SerializerOptions):File {
		return pick(doc, ['id', 'name', 'bytes', 'mime_type']) as File;
	}

	protected _simple(ctx: Context, doc: File, opts: SerializerOptions):File {
		const file = this._reduced(ctx, doc, opts);
		const cost = quota.getCost(doc);
		file.bytes = doc.bytes;
		file.cost = cost > 0 ? cost : undefined;
		file.url = FileDocument.getUrl(doc);
		file.is_protected = FileDocument.isPublic(doc) ? undefined : true;
		file.counter = doc.counter;

		// file variations
		file.variations = {};
		FileDocument.getVariations(doc).forEach(variation => {
			const cost = quota.getCost(doc, variation);
			file.variations[variation.name] = doc.variations ? doc.variations[variation.name] || {} : {};
			file.variations[variation.name].url = FileDocument.getUrl(doc, variation);
			file.variations[variation.name].is_protected = FileDocument.isPublic(doc, variation) ? undefined : true;
			file.variations[variation.name].cost = cost > 0 ? cost : undefined;
		});

		return file;
	}

	protected _detailed(ctx: Context, doc: File, opts: SerializerOptions):File {
		const file = this._simple(ctx, doc, opts);
		assign(file, pick(doc, ['is_active', 'created_at', 'file_type' ]));

		// metadata
		const metadataReader = Metadata.getReader(doc);
		if (metadataReader && doc.metadata) {
			file.metadata = metadataReader.serializeDetailed(doc.metadata);
		}
		return file;
	}
}
