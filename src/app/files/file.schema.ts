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

import { MetricsModel, Schema } from 'mongoose';

import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { RequestState } from '../common/typings/context';
import { state } from '../state';
import { File } from './file';
import { FileDocument, FilePathOptions } from './file.document';
import { mimeTypeNames } from './file.mimetypes';
import { fileTypes } from './file.types';
import { FileUtil } from './file.util';
import { FileVariation } from './file.variations';
import { processorQueue } from './processor/processor.queue';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const fileFields = {
	id: { type: String, required: true, unique: true, default: shortId.generate },
	name: { type: String, required: 'Filename must be provided.' },
	bytes: { type: Number, required: true },
	mime_type: {
		type: String,
		required: true,
		enum: {
			values: mimeTypeNames,
			message: 'Invalid MIME type. Valid MIME types are: ["' + mimeTypeNames.join('", "') + '"].',
		},
	},
	file_type: {
		type: String,
		required: true,
		enum: {
			values: fileTypes.names,
			message: 'Invalid file type. Valid file types are: ["' + fileTypes.names.join('", "') + '"].',
		},
	},
	metadata: { type: Schema.Types.Mixed },
	variations: { type: Schema.Types.Mixed },
	preprocessed: { type: Schema.Types.Mixed },
	is_active: { type: Boolean, required: true, default: false },
	counter: { downloads: { type: Number, default: 0 } },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
};

export interface FileModel extends MetricsModel<FileDocument> {}
export const fileSchema = new Schema(fileFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------

fileSchema.plugin(metricsPlugin);

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Switches a files from inactive to active and moves it to the public folder
 * if necessary.
 *
 * @return {Promise<FileDocument>} Moved file
 */
fileSchema.methods.switchToActive = async function(this: FileDocument, requestState: RequestState): Promise<FileDocument> {
	this.is_active = true;
	await this.save();
	await processorQueue.activateFile(requestState, this);
	return this;
};

fileSchema.methods.getPath = function(this: FileDocument, requestState: RequestState, variation: FileVariation = null, opts: FilePathOptions = {}): string {
	return File.getPath(requestState, this, variation, opts);
};
fileSchema.methods.getExt = function(this: FileDocument, variation: FileVariation = null): string {
	return File.getExt(this, variation);
};
fileSchema.methods.getUrl = function(this: FileDocument, requestState: RequestState, variation: FileVariation = null): string {
	return File.getUrl(requestState, this, variation);
};
fileSchema.methods.isPublic = function(this: FileDocument, requestState: RequestState, variation: FileVariation = null): boolean {
	return File.isPublic(requestState, this, variation);
};
fileSchema.methods.isFree = function(this: FileDocument, requestState: RequestState, variation: FileVariation = null): boolean {
	return File.isFree(requestState, this, variation);
};
fileSchema.methods.getMimeType = function(this: FileDocument, variation?: FileVariation): string {
	return File.getMimeType(this, variation);
};
fileSchema.methods.getMimeTypePrimary = function(this: FileDocument, variation: FileVariation = null): string {
	return File.getMimeTypePrimary(this, variation);
};
fileSchema.methods.getMimeSubtype = function(this: FileDocument, variation: FileVariation = null): string {
	return File.getMimeSubtype(this, variation);
};
fileSchema.methods.getMimeCategory = function(this: FileDocument, variation: FileVariation = null): string {
	return File.getMimeCategory(this, variation);
};
fileSchema.methods.toShortString = function(this: FileDocument, variation: FileVariation = null): string {
	return File.toShortString(this, variation);
};
fileSchema.methods.toDetailedString = function(this: FileDocument, variation?: FileVariation): string {
	return File.toDetailedString(this, variation);
};
fileSchema.methods.getExistingVariations = function(this: FileDocument): FileVariation[] {
	return File.getExistingVariations(this);
};
fileSchema.methods.getVariations = function(this: FileDocument): FileVariation[] {
	return File.getVariations(this);
};
fileSchema.methods.getVariation = function(this: FileDocument, variationName: string): FileVariation | null {
	return File.getVariation(this, variationName);
};
fileSchema.methods.getDirectVariationDependencies = function(this: FileDocument, variation: FileVariation): FileVariation[] {
	return File.getDirectVariationDependencies(this, variation);
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
fileSchema.post('remove', async (obj: FileDocument) => {

	// remove physical file
	await FileUtil.remove(null, obj);

	// remove eventually processing files
	await processorQueue.deleteProcessingFile(null, obj);

	// remove table blocks
	await state.models.TableBlock.update(
		{ _files: obj._id },
		{ $pull: { _files: obj._id } },
		{ multi: true },
	);
	await state.models.TableBlock.remove({ _files: { $size: 0 } });
});
