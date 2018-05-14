import { pick, assign } from 'lodash';
import { Build } from './build';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/types/context';

export class BuildSerializer extends Serializer<Build> {

	protected _reduced(ctx: Context, doc: Build, opts: SerializerOptions): Build {
		return pick(doc, ['id']) as Build;
	}

	protected _simple(ctx: Context, doc: Build, opts: SerializerOptions): Build {
		return pick(doc, ['id', 'label', 'platform', 'major_version', 'download_url', 'built_at', 'type', 'is_range']) as Build;
	}

	protected _detailed(ctx: Context, doc: Build, opts: SerializerOptions): Build {
		const build = this._simple(ctx, doc, opts);
		assign(build, pick(doc, ['support_url', 'description', 'is_active']));
		return build;
	}
}