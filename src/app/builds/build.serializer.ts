/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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
import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { BuildDocument } from './build.document';

export class BuildSerializer extends Serializer<BuildDocument> {

	public readonly modelName: ModelName = 'Build';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [],
		simple: [],
		detailed: [],
	};

	protected _reduced(ctx: Context, doc: BuildDocument, opts: SerializerOptions): BuildDocument {
		return pick(doc, ['id']) as BuildDocument;
	}

	protected _simple(ctx: Context, doc: BuildDocument, opts: SerializerOptions): BuildDocument {
		return pick(doc, ['id', 'label', 'platform', 'major_version', 'download_url', 'built_at', 'type', 'is_range']) as BuildDocument;
	}

	protected _detailed(ctx: Context, doc: BuildDocument, opts: SerializerOptions): BuildDocument {
		const build = this._simple(ctx, doc, opts);
		assign(build, pick(doc, ['support_url', 'description', 'is_active']));
		if (this._populated(doc, '_created_by')) {
			build.created_by = state.serializers.User.reduced(ctx, doc._created_by as UserDocument, opts);
		}
		return build;
	}
}
