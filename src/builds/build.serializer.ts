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