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

// NOTE: All categories without "fileType" fail validation. Add fileType when supported.
export const mediumCategories: { [key: string]: MediumCategory } = {
	flyer_image: {
		folder: 'Flyer Images',
		children: ['Back', 'Front', 'Inside1', 'Inside2', 'Inside3', 'Inside4', 'Inside5', 'Inside6'],
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
			ws: { folder: 'Table Images Desktop', fileType: 'playfield-ws' }
		},
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

export interface MediumCategory {
	folder?: string;
	fileType?: string;
	children?: string[];
	variations?: { [key: string]: { folder: string, fileType?: string } };
	mimeCategory: string;
	reference: string;
}