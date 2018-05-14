import { pick, assign } from 'lodash';
import { Context } from '../common/types/context';
import { Serializer, SerializerOptions } from '../common/serializer';
import { File } from './file';

const quota = require('../common/quota');
const storage = require('../../src_/modules/storage');

export class FileSerializer extends Serializer<File> {

	protected _reduced(ctx: Context, doc: File, opts: SerializerOptions):File {
		return pick(doc, ['id', 'name', 'bytes', 'mime_type']) as File;
	}

	protected _simple(ctx: Context, doc: File, opts: SerializerOptions):File {
		const file:File = this._reduced(ctx, doc, opts);
		file.bytes = doc.bytes;
		file.variations = storage.urls(doc);
		file.cost = quota.getCost(doc);
		file.url = storage.url(doc);
		file.is_protected = !doc.is_active || file.cost > -1;
		file.counter = (doc.counter as any).toObject();
		return file;
	}

	protected _detailed(ctx: Context, doc: File, opts: SerializerOptions):File {
		const file = this._simple(ctx, doc, opts);
		assign(file, pick(doc, ['is_active', 'created_at', 'file_type' ]));
		file.metadata = storage.metadataShort(doc);
		return file;
	}
}
