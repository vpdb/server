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
import { mapKeys, omit } from 'lodash';

import { Table } from 'vpx-toolbox';
import { RequestState } from '../../common/typings/context';
import { File } from '../file';
import { FileDocument } from '../file.document';
import { FileVariation } from '../file.variations';
import { Metadata } from './metadata';

export class VptMetadata extends Metadata {

	public isValid(file: FileDocument, variation?: FileVariation): boolean {
		return ['application/x-visual-pinball-table', 'application/x-visual-pinball-table-x']
			.includes(File.getMimeType(file, variation));
	}

	public async getMetadata(requestState: RequestState, file: FileDocument, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		const table = await Table.load(path, { gameDataOnly: true, tableInfoOnly: true });
		const script = await table.getTableScript();
		const props = mapKeys(table.tableInfo, key => {
			switch (key) {
				case 'TableName': return 'table_name';
				case 'AuthorName': return 'author_name';
				case 'TableBlurp': return 'table_blurp';
				case 'TableRules': return 'table_rules';
				case 'AuthorEmail': return 'author_email';
				case 'ReleaseDate': return 'release_date';
				case 'AuthorWebSite': return 'author_website';
				case 'TableDescription': return 'table_description';
				default: return key;
			}
		});
		props.table_script = script;
		return props;
	}

	public serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return omit(metadata, 'table_script');
	}

	public serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return omit(metadata, 'table_script');
	}
}
