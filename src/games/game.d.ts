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

import { FileReferenceDocument, MetricsDocument, PrettyIdDocument, Schema, Types } from 'mongoose';
import { Mpu } from '../common/ipdb';
import { File } from '../files/file';
import { User } from '../users/user';
import { Release } from '../releases/release';
import { Backglass } from '../backglasses/backglass';
import { Medium } from '../media/medium';

export interface Game extends FileReferenceDocument, MetricsDocument, PrettyIdDocument {
	id?: string;
	title: string;
	title_sortable?: string;
	year: number;
	manufacturer: string;
	game_type: 'ss' | 'em' | 'pm' | 'og' | 'na';
	_backglass?: File | Types.ObjectId;
	_logo?: File | Types.ObjectId;
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
	counter?: { [T in GameCounterType]: number; };
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
	_created_by?: User | Types.ObjectId;

	// serialized
	backglass?: File;
	logo?: File;
	releases?: Release[];
	backglasses?: Backglass[];
	media?: Medium[];

	// generated
	mpu?: Mpu;
	owner?: string;
	restrictions?: GameRestrictions;

	/**
	 * Checks whether the game as a restriction on the given model.
	 *
	 * @see [[GameDocument.isRestricted]] for implementation
	 * @param {'release' | 'backglass'} modelName
	 * @return {boolean} true if restricted, false otherwise.
	 */
	isRestricted(modelName: string): boolean;
}

export interface GameRestrictions {
	release?: GameRestriction;
	backglass?: GameRestriction;
	rom?: GameRestriction;
}

export interface GameRestriction {
	mpu?: boolean;
}

export type GameCounterType = 'releases' | 'views' | 'downloads' | 'comments' | 'stars';