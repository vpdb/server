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

export class FileSerializer extends Serializer<File> {

	protected _reduced(ctx: Context, doc: File, opts: SerializerOptions):File {
		return pick(doc, ['id', 'name', 'bytes', 'mime_type']) as File;
	}

	protected _simple(ctx: Context, doc: File, opts: SerializerOptions):File {
		const file = this._reduced(ctx, doc, opts);
		file.bytes = doc.bytes;
		file.cost = quota.getCost(doc);
		file.url = doc.getUrl();
		file.is_protected = !doc.is_active || file.cost > -1;
		file.counter = (doc.counter as any).toObject();

		// file variations
		file.variations = {};
		doc.getVariations().forEach(variation => {
			file.variations[variation.name] = doc.variations ? doc.variations[variation.name] || {} : {};
			file.variations[variation.name].url = doc.getUrl(variation);
			const cost = quota.getCost(doc, variation);
			if (!file.is_active || cost > -1) {
				file.variations[variation.name].is_protected = true;
			}
			if (cost > 0) {
				file.variations[variation.name].cost = cost;
			}
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
