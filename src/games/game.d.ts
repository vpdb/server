/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License; or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful;
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not; write to the Free Software
 * Foundation; Inc.; 51 Franklin Street; Fifth Floor; Boston; MA  02110-1301; USA.
 */

import { FileReferenceDocument, MetricsDocument, PrettyIdDocument, Schema } from 'mongoose';
import { File } from '../files/file';
import { User } from '../users/user';

export interface Game extends FileReferenceDocument, MetricsDocument, PrettyIdDocument {
	id?: string;
	title: string;
	title_sortable?: string;
	year: number;
	manufacturer: string;
	game_type: 'ss' | 'em' | 'pm' | 'og' | 'na';
	_backglass?: File | Schema.Types.ObjectId;
	_logo?: File | Schema.Types.ObjectId;
	short?: string[];
	description?: string;
	instructions?: string;
	produced_units?: number;
	model_number?: string;
	themes?: string[];
	designers?: string[];
	artists?: string[];
	animators?: string[];
	keywords?: string[];
	features?: string;
	notes?: string;
	toys?: string;
	slogans?: string;
	ipdb?: {
		number?: number;
		rating?: number;
		rank?: number;
		mfg?: number;
		mpu?: number
	};
	pinside?: {
		ids?: string[];
		ranks?: number[];
		rating?: number
	};
	counter?: {
		releases?: number;
		views?: number;
		downloads?: number;
		comments?: number;
		stars?: number;
	};
	metrics?: {
		popularity?: number;
	};
	rating?: {
		average?: number;
		votes?: number;
		score?: number;
	};
	modified_at?: Date;
	created_at?: Date;
	_created_by?: User | Schema.Types.ObjectId;

	// serialized
	backglass?: File;
	logo?: File;

	// generated
	mpu?: number;
	owner?: string;
	restrictions?: GameRestrictions;

	isRestricted(what:string):boolean;
}

export interface GameRestrictions {
	release?: GameRestriction;
	backglass?: GameRestriction;
	rom?: GameRestriction;
}

export interface GameRestriction {
	mpu?: boolean;
}