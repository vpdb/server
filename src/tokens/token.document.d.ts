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

import { Document, Types } from 'mongoose';
import { UserDocument } from '../users/user.document';

export interface TokenDocument extends Document {
	id: string;
	token: string;
	label: string;
	type: 'personal' | 'provider' | 'jwt-refreshed' | 'jwt';
	scopes: string[];
	provider: string;
	is_active: boolean;
	last_used_at: Date;
	expires_at: Date;
	created_at: Date;
	_created_by: UserDocument | Types.ObjectId;

	// generated
	browser?: IUAParser.IResult;
	for_user?: string;
	for_path?: string;
}
