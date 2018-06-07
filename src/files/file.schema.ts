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

import { includes } from 'lodash';
import { MetricsModel, Schema } from 'mongoose';

import { state } from '../state';
import { storage } from '../common/storage';
import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { mimeTypeNames } from './file.mimetypes';
import { File, FilePathOptions } from './file';
import { fileTypes } from './file.types';
import { FileVariation } from './file.variations';
import { processorQueue } from './processor/processor.queue';
import { FileDocument } from './file.document';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const fileFields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, required: 'Filename must be provided.' },
	bytes: { type: Number, required: true },
	mime_type: {
		type: String,
		required: true,
		'enum': {
			values: mimeTypeNames,
			message: 'Invalid MIME type. Valid MIME types are: ["' + mimeTypeNames.join('", "') + '"].'
		}
	},
	file_type: {
		type: String,
		required: true,
		'enum': {
			values: fileTypes.names,
			message: 'Invalid file type. Valid file types are: ["' + fileTypes.names.join('", "') + '"].'
		}
	},
	metadata: { type: Schema.Types.Mixed },
	variations: { type: Schema.Types.Mixed },
	preprocessed: { type: Schema.Types.Mixed },
	is_active: { type: Boolean, required: true, 'default': false },
	counter: { downloads: { type: Number, 'default': 0 } },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' }
};

export interface FileModel extends MetricsModel<File> {}
export const fileSchema = new Schema(fileFields, { toObject: { virtuals: true, versionKey: false } });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------

fileSchema.plugin(metricsPlugin);


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------

fileSchema.path('mime_type').validate(function (mimeType: string) {
	// will be validated by enum
	if (!this.file_type || !fileTypes.exists(this.file_type)) {
		return true;
	}
	if (!includes(fileTypes.getMimeTypes(this.file_type), mimeType)) {
		this.invalidate('mime_type', 'Invalid MIME type "' + mimeType + '" for file type "' + this.file_type + '". Valid MIME types are: ["' + fileTypes.getMimeTypes(this.file_type).join('", "') + '"].');
	}
});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Switches a files from inactive to active and moves it to the public folder
 * if necessary.
 *
 * @return {Promise<File>} Moved file
 */
fileSchema.methods.switchToActive = async function (this: File): Promise<File> {
	this.is_active = true;
	await this.save();
	await processorQueue.activateFile(this);
	return this;
};

fileSchema.methods.getPath = function (this: File, variation: FileVariation = null, opts: FilePathOptions = {}): string {
	return FileDocument.getPath(this, variation, opts);
};
fileSchema.methods.getExt = function (this: File, variation: FileVariation = null): string {
	return FileDocument.getExt(this, variation);
};
fileSchema.methods.getUrl = function (this: File, variation: FileVariation = null): string {
	return FileDocument.getUrl(this, variation);
};
fileSchema.methods.isPublic = function (this: File, variation: FileVariation = null): boolean {
	return FileDocument.isPublic(this, variation);
};
fileSchema.methods.isFree = function (this: File, variation: FileVariation = null): boolean {
	return FileDocument.isFree(this, variation);
};
fileSchema.methods.getMimeType = function (this: File, variation?: FileVariation): string {
	return FileDocument.getMimeType(this, variation);
};
fileSchema.methods.getMimeTypePrimary = function (this: File, variation: FileVariation = null): string {
	return FileDocument.getMimeTypePrimary(this, variation);
};
fileSchema.methods.getMimeSubtype = function (this: File, variation: FileVariation = null): string {
	return FileDocument.getMimeSubtype(this, variation);
};
fileSchema.methods.getMimeCategory = function (this: File, variation: FileVariation = null): string {
	return FileDocument.getMimeCategory(this, variation);
};
fileSchema.methods.toShortString = function (this: File, variation: FileVariation = null): string {
	return FileDocument.toShortString(this, variation);
};
fileSchema.methods.toDetailedString = function (this: File, variation?: FileVariation): string {
	return FileDocument.toDetailedString(this, variation);
};
fileSchema.methods.getExistingVariations = function (this: File): FileVariation[] {
	return FileDocument.getExistingVariations(this);
};
fileSchema.methods.getVariations = function (this: File): FileVariation[] {
	return FileDocument.getVariations(this);
};
fileSchema.methods.getVariation = function (this: File, variationName: string): FileVariation | null {
	return FileDocument.getVariation(this, variationName);
};
fileSchema.methods.getVariationDependencies = function (this: File, variation: FileVariation, deps: FileVariation[] = []): FileVariation[] {
	return FileDocument.getVariationDependencies(this, variation, deps);
};
fileSchema.methods.getDirectVariationDependencies = function (this: File, variation: FileVariation): FileVariation[] {
	return FileDocument.getDirectVariationDependencies(this, variation);
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
fileSchema.post('remove', async function (obj: File) {

	// remove eventually processing files
	await processorQueue.deleteProcessingFile(obj);

	// remove physical file
	await storage.remove(obj);

	// remove table blocks
	await state.models.TableBlock.update(
		{ _files: obj._id },
		{ $pull: { _files: obj._id } },
		{ multi: true }
	);
	await state.models.TableBlock.remove({ _files: { $size: 0 } });
});
