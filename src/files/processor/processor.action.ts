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


export class DeleteFileAction extends ProcessorAction {

	name: string = 'delete.file';

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