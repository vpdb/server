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
import { extend, omit } from 'lodash';

import { Metadata } from './metadata';
import { File } from '../file';
import { FileVariation } from '../file.variations';
import { visualPinballTable } from '../../common/visualpinball.table';
import { FileDocument } from '../file.document';

export class VptMetadata extends Metadata {

	isValid(file: File, variation?: FileVariation): boolean {
		return ['application/x-visual-pinball-table', 'application/x-visual-pinball-table-x']
			.includes(FileDocument.getMimeType(file, variation));
	}

	async getMetadata(file: File, path: string, variation?: FileVariation): Promise<{ [p: string]: any }> {
		const script = await visualPinballTable.readScriptFromTable(path);
		const props = await visualPinballTable.getTableInfo(path);
		extend(props, { table_script: script.code });
		return props;
	}

	serializeDetailed(metadata: { [p: string]: any }): { [p: string]: any } {
		return omit(metadata, 'table_script');
	}

	serializeVariation(metadata: { [p: string]: any }): { [p: string]: any } {
		return omit(metadata, 'table_script');
	}
}