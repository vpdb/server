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

import { pick } from 'lodash';
import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { FileDocument } from '../files/file.document';
import { GameDocument } from '../games/game.document';
import { ReleaseDocument } from '../releases/release.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { MediumDocument } from './medium.document';

export class MediumSerializer extends Serializer<MediumDocument> {

	public readonly modelName: ModelName = 'Medium';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [
			{ path: 'file', modelName: 'File', level: 'detailed' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
			{ path: 'game', modelName: 'Game', level: 'simple' },
			{ path: 'release', modelName: 'Release', level: 'simple' },
		],
		simple: [
			{ path: 'file', modelName: 'File', level: 'detailed' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
			{ path: 'game', modelName: 'Game', level: 'simple' },
			{ path: 'release', modelName: 'Release', level: 'simple' },
		],
		detailed: [
			{ path: 'file', modelName: 'File', level: 'detailed' },
			{ path: 'created_by', modelName: 'User', level: 'reduced' },
			{ path: 'game', modelName: 'Game', level: 'simple' },
			{ path: 'release', modelName: 'Release', level: 'simple' },
		],
	};

	/* istanbul ignore next */
	protected _reduced(ctx: Context, doc: MediumDocument, opts: SerializerOptions): MediumDocument {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: MediumDocument, opts: SerializerOptions): MediumDocument {
		const medium = pick(doc, ['id', 'category', 'description', 'acknowledgements', 'created_at']) as MediumDocument;
		if (this._populated(doc, '_file')) {
			medium.file = state.serializers.File.detailed(ctx, doc._file as FileDocument, opts);
		}
		if (this._populated(doc, '_created_by')) {
			medium.created_by = state.serializers.User.reduced(ctx, doc._created_by as UserDocument, opts);
		}
		if (this._populated(doc, '_ref.game')) {
			medium.game = state.serializers.Game.simple(ctx, doc._ref.game as GameDocument, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			medium.release = state.serializers.Release.simple(ctx, doc._ref.release as ReleaseDocument, opts);
		}
		return medium;
	}

	/* istanbul ignore next */
	protected _detailed(ctx: Context, doc: MediumDocument, opts: SerializerOptions): MediumDocument {
		return this._simple(ctx, doc, opts);
	}
}
