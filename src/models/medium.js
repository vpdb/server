/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const _ = require('lodash');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');
const paginate = require('mongoose-paginate');
const uniqueValidator = require('mongoose-unique-validator');

const prettyId = require('./plugins/pretty-id');
const fileRef = require('./plugins/file-ref');
const metrics = require('./plugins/metrics');

const Schema = mongoose.Schema;

// NOTE: All categories without "fileType" fail validation. Add fileType when supported.
const categories = {
	flyer_image: {
		folder: 'Flyer Images',
		children: [ 'Back', 'Front', 'Inside1', 'Inside2' , 'Inside3' , 'Inside4' , 'Inside5' , 'Inside6' ],
		mimeCategory: 'image',
		reference: 'game'
	},
	gameplay_video: {
		folder: 'Gameplay Videos',
		mimeCategory: 'video',
		reference: 'game'
	},
	instruction_card: {
		folder: 'Instruction Cards',
		mimeCategory: 'image',
		reference: 'game'
	},
	backglass_image: {
		folder: 'Backglass Images',
		fileType: 'backglass',
		mimeCategory: 'image',
		reference: 'game'
	},
	backglass_video: {
		folder: 'Backglass Videos',
		fileType: 'backglass',
		mimeCategory: 'video',
		reference: 'game'
	},
	dmd_image: {
		folder: 'DMD Images',
		mimeCategory: 'image',
		reference: 'game'
	},
	dmd_video: {
		folder: 'DMD Videos',
		mimeCategory: 'video',
		reference: 'game'
	},
	real_dmd_image: {
		folder: 'Real DMD Images',
		mimeCategory: 'image',
		reference: 'game'
	},
	real_dmd_video: {
		folder: 'Real DMD Videos',
		mimeCategory: 'video',
		reference: 'game'
	},
	table_audio: {
		folder: 'Table Audio',
		mimeCategory: 'audio',
		reference: 'game'
	},
	playfield_image: {
		variations: {
			fs: { folder: 'Table Images', fileType: 'playfield-fs' },
			ws: { folder: 'Table Images Desktop', fileType: 'playfield-ws' } },
		mimeCategory: 'image',
		reference: 'release'
	},
	playfield_video: {
		variations: {
			fs: { folder: 'Table Videos' },
			ws: { folder: 'Table Videos Desktop' }
		},
		mimeCategory: 'video',
		reference: 'release'
	},
	wheel_image: {
		folder: 'Wheel Images',
		fileType: 'logo',
		mimeCategory: 'image',
		reference: 'game'
	}
};

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const mediumFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	_file:         { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	_ref: {
		game:      { type: Schema.ObjectId, ref: 'Game', index: true },
		release:   { type: Schema.ObjectId, ref: 'Release', index: true }
	},
	category:      { type: String, required: 'You must provide a category' },
	description:   { type: String },
	acknowledgements: { type: String },
	counter:       {
		stars:     { type: Number, 'default': 0 }
	},
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User', required: true }
};
const MediumSchema = new Schema(mediumFields, { usePushEach: true });

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
const apiFields = {
	simple: [ 'id', 'file', 'game', 'release', 'category', 'description', 'acknowledgements', 'created_at', 'created_by' ]
};

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
MediumSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
MediumSchema.plugin(prettyId, { model: 'Medium', ignore: [ '_created_by' ] });
MediumSchema.plugin(fileRef);
MediumSchema.plugin(paginate);
MediumSchema.plugin(metrics);


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
MediumSchema.virtual('file')
	.get(function() {
		if (this._file && this._file.toDetailed) {
			return this._file.toDetailed();
		}
	});

MediumSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this._created_by.toReduced) {
			return this._created_by.toReduced();
		}
	});

MediumSchema.virtual('game')
	.get(function() {
		if (this._ref && this._ref.game && this._ref.game.toSimple) {
			return this._ref.game.toSimple();
		}
	});

MediumSchema.virtual('release')
	.get(function() {
		if (this._ref && this._ref.release && this._ref.release.toSimple) {
			return this._ref.release.toSimple();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
MediumSchema.methods.toSimple = function() {
	return _.pick(this.toObj(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
MediumSchema.path('category').validate(function() {
	let [ categoryName, childName ] = this.category.split('/');
	let category = categories[categoryName];

	// validate category
	if (!category) {
		this.invalidate('category', 'Invalid category "' + categoryName + '". Must be one of: [ "' + _.keys(categories).join('", "') + '" ].');
		return true;
	}

	// validate folder children
	if (category.children) {
		const children = category.children.map(child => child.toLowerCase());
		if (!childName) {
			this.invalidate('category', 'Must provide sub-category for "' + categoryName + '". Possible values: [ "' + children.join('", "') + '" ].');

		} else if (!children.includes(childName)) {
			this.invalidate('category', 'Invalid sub-category "' + childName + '" for "' + categoryName + '". Must be one of: [ "' + children.join('", "') + '" ].');
		}
	}

	// validate variation children
	if (category.variations) {
		if (!childName) {
			this.invalidate('category', 'Must provide sub-category for "' + categoryName + '". Possible values: [ "' + _.keys(category.variations).join('", "') + '" ].');

		} else if (!category.variations[childName]) {
			this.invalidate('category', 'Invalid sub-category "' + childName + '" for "' + categoryName + '". Must be one of: [ "' + _.keys(category.variations).join('", "') + '" ].');

		} else if (!category.variations[childName].fileType) {
			// invalidate if no fileType is set
			this.invalidate('category', 'Sorry, ' + category.variations[childName].folder + ' are not supported yet.');
		}

	} else {
		// invalidate if no fileType is set
		if (!category.fileType) {
			this.invalidate('category', 'Sorry, ' + category.folder + ' are not yet supported.');
		}
	}

	// validate reference
	if (!this._ref[category.reference]) {
		this.invalidate('_ref', 'Reference to ' + category.reference + ' missing.');
	}


});

MediumSchema.path('_file').validate(function(value) {
	const File =  mongoose.model('File');
	return Promise.try(() => {
		return File.findById(value).exec();

	}).then(file => {
		let [ categoryName, childName ] = this.category.split('/');
		let category = categories[categoryName];
		if (category) {

			// check mime type
			if (file.getMimeCategory() !== category.mimeCategory) {
				this.invalidate('_file', 'Invalid MIME type, must be a ' + category.mimeCategory + ' but is a ' + file.getMimeCategory() + '.');
			}

			// check file type
			if (category.variations) {
				if (category.variations[childName] && category.variations[childName].fileType && category.variations[childName].fileType !== file.file_type) {
					this.invalidate('_file', 'Invalid file type, must be a ' + category.variations[childName].fileType + ' but is a ' + file.file_type + '.');
				}

			} else {
				if (category.fileType && category.fileType !== file.file_type) {
					this.invalidate('_file', 'Invalid file type, must be a ' + category.fileType + ' but is a ' + file.file_type + '.');
				}
			}

		}
		return true;

	});
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
MediumSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Medium', MediumSchema);
logger.info('[model] Schema "Medium" registered.');