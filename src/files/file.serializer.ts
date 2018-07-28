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
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/typings/context';
import { File } from './file';
import { FileDocument } from './file.document';
import { Metadata } from './metadata/metadata';

export class FileSerializer extends Serializer<FileDocument> {

	protected _reduced(ctx: Context, doc: FileDocument, opts: SerializerOptions): FileDocument {
		return pick(doc, ['id', 'name', 'bytes', 'mime_type']) as FileDocument;
	}

	protected _simple(ctx: Context, doc: FileDocument, opts: SerializerOptions): FileDocument {
		const file = this._reduced(ctx, doc, opts);
		const cost = quota.getCost(ctx.state, doc);
		file.bytes = doc.bytes;
		file.cost = cost > 0 ? cost : undefined;
		file.url = File.getUrl(ctx.state, doc);
		file.is_protected = File.isPublic(ctx.state, doc) ? undefined : true;
		file.counter = doc.counter;

		// file variations
		file.variations = {};
		File.getVariations(doc).forEach(variation => {
			const fileCost = quota.getCost(ctx.state, doc, variation);
			file.variations[variation.name] = doc.variations ? doc.variations[variation.name] || {} : {};
			file.variations[variation.name].url = File.getUrl(ctx.state, doc, variation);
			file.variations[variation.name].is_protected = File.isPublic(ctx.state, doc, variation) ? undefined : true;
			file.variations[variation.name].fileCost = fileCost > 0 ? fileCost : undefined;
		});

		return file;
	}

	protected _detailed(ctx: Context, doc: FileDocument, opts: SerializerOptions): FileDocument {
		const file = this._simple(ctx, doc, opts);
		assign(file, pick(doc, ['created_at', 'file_type']));
		if ((opts && opts.fields && opts.fields.includes('is_active')) || !doc.is_active) {
			file.is_active = doc.is_active;
		}

		// metadata
		const metadataReader = Metadata.getReader(doc);
		if (metadataReader && doc.metadata) {
			file.metadata = metadataReader.serializeDetailed(doc.metadata);
		}
		return file;
	}
}
