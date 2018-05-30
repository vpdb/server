import { Serializer, SerializerOptions } from '../common/serializer';
import { Rom } from './rom';
import { Context } from '../common/types/context';
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
		rom.rom_files = (doc.rom_files as any).toObject().map((f:any) => pick(f, ['filename', 'bytes', 'crc', 'modified_at']));

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