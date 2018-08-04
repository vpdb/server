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

import { mapValues } from 'lodash';

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

export class ReleaseFlavors {

	public values: { [key: string]: { [key: string]: ReleaseFlavor } } = {

		orientation: {
			fs: {
				name: 'Portrait',
				hint: 'Cabinet',
				description: 'Rotated portrait, usually 270°. Also known as "FS" (fullscreen).',
				filenameTag: 'FS',
			},
			ws: {
				name: 'Desktop',
				hint: 'Landscape',
				description: 'Typical landscape monitor orientation, also known as "DT" (desktop).',
				filenameTag: 'DT',
			},
			any: {
				name: 'Universal',
				hint: 'Any orientation',
				description: 'Tables built with VP10+ that are fully 3D and can be rendered at any orientation.',
				filenameTag: '',
			},
		},
		lighting: {
			day: {
				name: 'Day',
				hint: 'Illuminated Playfield',
				description: 'Ambient light is high, resulting in a low contrast between playfield and lamps.',
				filenameTag: '',
			},
			night: {
				name: 'Night',
				hint: 'Dark Playfield',
				description: 'Ambient light is low, resulting in a high contrast between playfield and lamps.',
				filenameTag: 'Nightmod',
			},
			any: {
				name: 'Universal',
				hint: 'Customizable',
				description: 'Tables built with VP10+ where lighting can be adjusted with the slider.',
				filenameTag: '',
			},
		},
	};

	public flavorTypes(): string[] {
		return Object.keys(this.values);
	}

	public flavorValues(flavorType: string): { [key: string]: ReleaseFlavor } {
		return this.values[flavorType];
	}

	public defaultFileTags() {
		return mapValues(this.values, flavorType => {
			// flavorType = { fs: { name: 'Portrait', ..., filenameTag: 'FS' }}
			return mapValues(flavorType, (flavorItem: ReleaseFlavor) => {
				// flavorItem = { name: 'Portrait', ..., filenameTag: 'FS' }
				return flavorItem.filenameTag;
			});
		});
	}

	/**
	 * Returns default thumb settings. Opts override defaults.
	 *
	 * @param {{ lighting:string, orientation:string }} [opts] Options
	 * @returns {{ lighting:string, orientation:string }} Default thumb
	 */
	public defaultThumb(opts?: { lighting?: string, orientation?: string }): { lighting: string, orientation: string, [key: string]: string } {
		opts = opts || {};
		return {
			lighting: opts.lighting || 'day',
			orientation: opts.orientation || 'fs',
		};
	}
}

export interface ReleaseFlavor {
	name: string;
	hint: string;
	description: string;
	filenameTag: string;
}

export const flavors = new ReleaseFlavors();
