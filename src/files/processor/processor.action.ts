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

import { rename } from 'fs';
import { promisify } from 'util';
import { state } from '../../state';

const renameAsync = promisify(rename);

/**
 * An action is a blocking function that is run after all jobs for a given file
 * have completed.
 *
 * Contrarily to processors, actions are dynamically triggered, i.e. actions
 * are only added to the queue when necessary. Additionally, an action applies
 * to the file *and all variations* of the file.
 *
 * Actions can be added even though processing for a given file has already
 * been finished a long time ago. In this case it will be executed immediately.
 */
export abstract class ProcessorAction {

	public abstract name: string;

	public abstract async run(fileId: string): Promise<void>;
}

export class ActivateFileAction extends ProcessorAction {

	name: string = 'file.activated';

	async run(fileId: string): Promise<void> {
		// update database
		const file = await state.models.File.findOne({ id: fileId }).exec();
		await state.models.File.findByIdAndUpdate(file._id, { $set: { is_active: true } }).exec();
		file.is_active = true;

		// rename files
		await renameAsync(file.getPath(null, { forceProtected: true }), file.getPath());
		for (let variation of file.getVariations()) {
			await renameAsync(file.getPath(variation, { forceProtected: true }), file.getPath(variation));
		}
	}
}

